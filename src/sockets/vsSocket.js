'use strict';

const matchService = require('../../services/matchService');
const aiReactionService = require('../../services/aiReactionService');

// lobbyPlayers: socketId → { userId, username, planetId, stageId }
const lobbyPlayers = new Map();

function broadcastLobby(io) {
  const players = [...lobbyPlayers.values()].map(p => ({ userId: p.userId, username: p.username, avatarId: p.avatarId }));
  io.to('lobby').emit('lobbyUpdate', { players });
}

// Emit matchFinished immediately, then follow up with achievements once they resolve.
async function emitMatchFinished(io, match) {
  io.to(`vs_${match.matchId}`).emit('matchFinished', {
    matchId:            match.matchId,
    winnerId:           match.winnerId ?? null,
    players:            match.players.map(p => ({ userId: p.userId, username: p.username, score: p.score })),
    achievementRewards: [],
  });

  if (match._achievementsPromise) {
    match._achievementsPromise
      .then(async () => {
        const sockets = await io.in(`vs_${match.matchId}`).fetchSockets();
        for (const s of sockets) {
          const rewards = match.achievementsByPlayer?.[s.data.userId] ?? [];
          if (rewards.length > 0)
            s.emit('achievementRewards', { matchId: match.matchId, rewards });
        }
      })
      .catch(e => console.error('[vsSocket] achievements error:', e.message));
  }
}

// Emit matchFinished to one socket immediately (disconnect case).
// Achievements are sent in a follow-up event once processing completes.
function emitMatchFinishedToSocket(match, targetSocket) {
  targetSocket.emit('matchFinished', {
    matchId:           match.matchId,
    winnerId:          match.winnerId ?? null,
    players:           match.players.map(p => ({ userId: p.userId, username: p.username, score: p.score })),
    achievementRewards: [],
  });

  if (match._achievementsPromise) {
    match._achievementsPromise
      .then(() => {
        const rewards = match.achievementsByPlayer?.[targetSocket.data.userId] ?? [];
        if (rewards.length > 0 && targetSocket.connected) {
          targetSocket.emit('achievementRewards', { matchId: match.matchId, rewards });
        }
      })
      .catch(e => console.error('[vsSocket] achievements error:', e.message));
  }
}

module.exports = (io) => {
  io.on('connection', (socket) => {

    // ── Lobby ────────────────────────────────────────────────────

    socket.on('joinLobby', ({ userId, username, avatarId, planetId, stageId }) => {
      if (!userId) return;
      socket.join('lobby');
      socket.data.userId = userId;
      lobbyPlayers.set(socket.id, { userId, username: username || userId, avatarId: avatarId || 'avatar', planetId, stageId });
      broadcastLobby(io);
    });

    socket.on('leaveLobby', () => {
      socket.leave('lobby');
      lobbyPlayers.delete(socket.id);
      broadcastLobby(io);
    });

    socket.on('challengePlayer', async ({ targetUserId }) => {
      const challenger = lobbyPlayers.get(socket.id);
      if (!challenger) return;

      const targetEntry = targetUserId
        ? [...lobbyPlayers.entries()].find(([, p]) => p.userId === targetUserId)
        : [...lobbyPlayers.entries()].find(([id]) => id !== socket.id);

      if (!targetEntry) { socket.emit('challengeError', 'No players available'); return; }
      const [targetSocketId, target] = targetEntry;

      io.to(targetSocketId).emit('challenged', {});

      // Remove both atomically before the async operation
      lobbyPlayers.delete(socket.id);
      lobbyPlayers.delete(targetSocketId);
      socket.leave('lobby');
      io.sockets.sockets.get(targetSocketId)?.leave('lobby');
      broadcastLobby(io);

      socket.data.pendingTargetId = targetSocketId;
      const pendingTargetSocket = io.sockets.sockets.get(targetSocketId);
      if (pendingTargetSocket) pendingTargetSocket.data.pendingChallengerId = socket.id;

      try {
        const match = await matchService.createMatchForTwo(
          { userId: challenger.userId, username: challenger.username, planetId: challenger.planetId, stageId: challenger.stageId },
          { userId: target.userId,     username: target.username,     planetId: target.planetId,     stageId: target.stageId }
        );

        delete socket.data.pendingTargetId;
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) delete targetSocket.data.pendingChallengerId;

        const challengerGone = !socket.connected;
        const targetGone     = !targetSocket || !targetSocket.connected;

        if (challengerGone || targetGone) {
          matchService.forceEndMatch(match.matchId);
          if (challengerGone && targetSocket?.connected)
            targetSocket.emit('challengeError', 'Opponent disconnected before match started');
          if (targetGone && socket.connected)
            socket.emit('challengeError', 'Opponent disconnected before match started');
          return;
        }

        // Tag both sockets so the disconnect handler can find the opponent
        // even before joinVsMatch is emitted by the clients
        socket.data.matchId       = match.matchId;
        targetSocket.data.matchId = match.matchId;

        socket.emit('matchReady',       { ...match, myUserId: challenger.userId });
        targetSocket.emit('matchReady', { ...match, myUserId: target.userId });

      } catch (e) {
        console.error('[lobby] createMatchForTwo error:', e.message);
        delete socket.data.pendingTargetId;
        const ts = io.sockets.sockets.get(targetSocketId);
        if (ts) delete ts.data.pendingChallengerId;
        lobbyPlayers.set(socket.id, challenger);
        lobbyPlayers.set(targetSocketId, target);
        broadcastLobby(io);
        socket.emit('challengeError', e.message);
      }
    });

    // ── VS Match ─────────────────────────────────────────────────

    socket.on('joinVsMatch', ({ matchId, userId }) => {
      if (!matchId || !userId) return;
      socket.join(`vs_${matchId}`);
      socket.data.matchId = matchId;
      socket.data.userId  = userId;
    });

    // Both players send this after their stage finishes loading.
    // When both have sent it the server sets startTime and emits matchStarted + starts authoritative timer.
    socket.on('playerReady', ({ matchId, userId }) => {
      if (!matchId) return;
      try {
        const match = matchService.playerReady(matchId, userId);
        if (match.startTime !== null && !match._startEmitted) {
          match._startEmitted = true;
          io.to(`vs_${matchId}`).emit('matchStarted', { matchId, startTime: match.startTime });

          // Server-authoritative timer — ends the match when duration elapses
          match._timerHandle = setTimeout(async () => {
            const m = matchService.getMatchRaw(matchId);
            if (!m || m.status !== 'active') return;
            matchService.endMatchByTimeout(matchId);
            await emitMatchFinished(io, m);
          }, match.duration * 1000);
        }
      } catch (e) {
        console.error('[vsSocket] playerReady error:', e.message);
        socket.emit('matchError', { message: 'Failed to start match. Please return to the planet map.' });
      }
    });

    // Real-time score push — broadcast current scores to the whole room
    socket.on('vsScore', async ({ matchId, userId, score }) => {
      try {
        const prev = matchService.getMatchRaw(matchId);
        if (!prev) return;

        const prevPlayer   = prev.players.find(p => p.userId === userId);
        const prevScore    = prevPlayer?.score ?? 0;
        const prevOppScore = prev.players.find(p => p.userId !== userId)?.score ?? 0;

        const match    = matchService.updateScore(matchId, userId, score);
        const oppScore = match.players.find(p => p.userId !== userId)?.score ?? 0;
        const delta    = score - prevScore;

        io.to(`vs_${matchId}`).emit('vsMatchState', {
          players: match.players.map(p => ({ userId: p.userId, score: p.score })),
        });

        triggerReactions(io, matchId, userId, score, prevScore, oppScore, prevOppScore, delta)
          .catch(e => console.error('[vsSocket] triggerReactions error:', e.message));

      } catch (e) {
        console.error('[vsSocket] vsScore error:', e.message);
      }
    });

    // Player deck empty — end match and notify both sides (time expiry is handled by server timer)
    socket.on('submitScore', async ({ matchId, userId, finalScore }) => {
      try {
        const match = matchService.getMatchRaw(matchId);
        if (!match || match.status !== 'active') return;

        if (match._timerHandle) { clearTimeout(match._timerHandle); match._timerHandle = null; }

        matchService.submitFinalScore(matchId, userId, finalScore);
        await emitMatchFinished(io, match);
      } catch (e) {
        console.error('[vsSocket] submitScore error:', e.message);
      }
    });

    // ── Disconnect ───────────────────────────────────────────────

    socket.on('disconnect', async () => {
      if (lobbyPlayers.has(socket.id)) {
        lobbyPlayers.delete(socket.id);
        broadcastLobby(io);
      }

      const matchId = socket.data.matchId;
      if (!matchId) return;

      const match = matchService.getMatchRaw(matchId);
      if (!match || match.status !== 'active') return;

      if (match._timerHandle) { clearTimeout(match._timerHandle); match._timerHandle = null; }
      matchService.forfeitMatch(matchId, socket.data.userId);

      // Find the remaining player — search by matchId tag, not room membership,
      // so this works even if the opponent hasn't joined the vs_ room yet (still loading).
      const opponentSocket = [...io.sockets.sockets.values()]
        .find(s => s.data.matchId === matchId && s.id !== socket.id);

      if (opponentSocket) {
        await emitMatchFinishedToSocket(match, opponentSocket);
      }
    });

  });
};

async function triggerReactions(io, matchId, scoringUserId, myScore, prevMyScore, oppScore, prevOppScore, delta) {
  const sockets = await io.in(`vs_${matchId}`).fetchSockets();

  const sendTo = (userId, message) => {
    for (const s of sockets) {
      if (s.data.userId === userId) s.emit('vsReaction', { message });
    }
  };

  if (delta >= 3) {
    const msg = await aiReactionService.generateReaction('bigMove', matchId + '_opp', { delta });
    if (msg) sendTo(sockets.find(s => s.data.userId !== scoringUserId)?.data?.userId, msg);
  }

  if (myScore > oppScore && prevMyScore <= prevOppScore) {
    const msg = await aiReactionService.generateReaction('overtake', matchId + '_over_' + scoringUserId);
    if (msg) sendTo(scoringUserId, msg);
  }

  const gap     = oppScore - myScore;
  const prevGap = prevOppScore - prevMyScore;
  if (gap >= 5 && prevGap < 5) {
    const opponentId = sockets.find(s => s.data.userId !== scoringUserId)?.data?.userId;
    if (opponentId) {
      const msg = await aiReactionService.generateReaction('underdog', matchId + '_under_' + opponentId, { gap });
      if (msg) sendTo(opponentId, msg);
    }
  }
}
