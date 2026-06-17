const matchService = require('../../services/matchService');
const { forfeitMatch, matchEvents } = matchService;
const aiReactionService = require('../../services/aiReactionService');

// lobbyPlayers: socketId → { userId, username, planetId, stageId }
const lobbyPlayers = new Map();

function broadcastLobby(io) {
  const players = [...lobbyPlayers.values()].map(p => ({ userId: p.userId, username: p.username }));
  io.to('lobby').emit('lobbyUpdate', { players });
}

module.exports = (io) => {
  matchEvents.on('playerFinished', ({ matchId, finishedUserId }) => {
    const allSockets = [...io.sockets.sockets.values()];
    const finishedSocket = allSockets.find(s => s.data.matchId === matchId && s.data.userId === finishedUserId);
    if (finishedSocket) {
      io.to(`vs_${matchId}`).except(finishedSocket.id).emit('opponentFinished', {});
    } else {
      const opponentSocket = allSockets.find(s => s.data.matchId === matchId && s.data.userId !== finishedUserId);
      opponentSocket?.emit('opponentFinished', {});
    }
  });
  io.on('connection', (socket) => {

    // ── Lobby ────────────────────────────────────────────────────

    socket.on('joinLobby', ({ userId, username, planetId, stageId }) => {
      if (!userId) return;
      socket.join('lobby');
      socket.data.userId = userId;
      lobbyPlayers.set(socket.id, { userId, username: username || userId, planetId, stageId });
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

      // Random: pick any waiting player that isn't the challenger
      const targetEntry = targetUserId
        ? [...lobbyPlayers.entries()].find(([, p]) => p.userId === targetUserId)
        : [...lobbyPlayers.entries()].find(([id, p]) => id !== socket.id);

      if (!targetEntry) { socket.emit('challengeError', 'No players available'); return; }
      const [targetSocketId, target] = targetEntry;

      // Notify target immediately so their UI disables
      io.to(targetSocketId).emit('challenged', {});

      // Remove both BEFORE the async operation — prevents concurrent challenges
      // from matching the same player twice (Node.js is single-threaded so this
      // deletion is atomic relative to other incoming events)
      lobbyPlayers.delete(socket.id);
      lobbyPlayers.delete(targetSocketId);
      socket.leave('lobby');
      io.sockets.sockets.get(targetSocketId)?.leave('lobby');
      broadcastLobby(io);

      // Track pending challenge so disconnect during createMatchForTwo can notify target
      socket.data.pendingTargetId = targetSocketId;
      const pendingTargetSocket = io.sockets.sockets.get(targetSocketId);
      if (pendingTargetSocket) pendingTargetSocket.data.pendingChallengerId = socket.id;

      try {
        const match = await matchService.createMatchForTwo(
          { userId: challenger.userId, username: challenger.username, planetId: challenger.planetId, stageId: challenger.stageId },
          { userId: target.userId, username: target.username, planetId: target.planetId, stageId: target.stageId }
        );


        delete socket.data.pendingTargetId;
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) delete targetSocket.data.pendingChallengerId;

        // If either player disconnected during async match creation — abort
        const challengerGone = !socket.connected;
        const targetGone = !targetSocket || !targetSocket.connected;

        if (challengerGone || targetGone) {
          matchService.forceEndMatch(match.matchId);
          if (challengerGone && targetSocket?.connected) {
            targetSocket.emit('challengeError', 'Opponent disconnected before match started');
          }
          if (targetGone && socket.connected) {
            socket.emit('challengeError', 'Opponent disconnected before match started');
          }
          return;
        }

        // Both still connected — tag and notify
        socket.data.matchId = match.matchId;
        targetSocket.data.matchId = match.matchId;

        socket.emit('matchReady', { ...match, myUserId: challenger.userId });
        targetSocket.emit('matchReady', { ...match, myUserId: target.userId });

      } catch (e) {
        console.error('[lobby] createMatchForTwo error:', e.message);
        delete socket.data.pendingTargetId;
        const ts = io.sockets.sockets.get(targetSocketId);
        if (ts) delete ts.data.pendingChallengerId;
        // Re-add both to lobby so they can try again
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
      socket.data.userId = userId;
    });

    socket.on('vsScore', async ({ matchId, userId, score }) => {
      try {
        const prev = matchService.getMatchRaw(matchId);
        if (!prev) return;

        const prevPlayer = prev.players.find(p => p.userId === userId);
        const prevScore = prevPlayer?.score ?? 0;
        const prevOppScore = prev.players.find(p => p.userId !== userId)?.score ?? 0;

        const match = matchService.updateScore(matchId, userId, score);
        const oppScore = match.players.find(p => p.userId !== userId)?.score ?? 0;
        const delta = score - prevScore;

        io.to(`vs_${matchId}`).emit('vsMatchState', {
          players: match.players.map(p => ({ userId: p.userId, score: p.score })),
        });

        triggerReactions(io, matchId, userId, score, prevScore, oppScore, prevOppScore, delta).catch((e) => {
          console.error('[vsSocket] triggerReactions error:', e.message);
        });

      } catch (e) {
        console.error('[vsSocket] vsScore error:', e.message);
      }
    });

    // ── Disconnect ───────────────────────────────────────────────

    socket.on('disconnect', () => {
      if (lobbyPlayers.has(socket.id)) {
        lobbyPlayers.delete(socket.id);
        broadcastLobby(io);
      }

      if (socket.data.pendingTargetId || socket.data.pendingChallengerId) {
        // createMatchForTwo will send challengeError after it completes
      }

      const matchId = socket.data.matchId;
      if (matchId) {
        const match = matchService.getMatchRaw(matchId);
        if (match && match.status === 'active') {
          const room = io.sockets.adapter.rooms.get(`vs_${matchId}`);
          const remaining = room ? room.size : 0;
          if (remaining === 0) {
            // Check if opponent is still connected but hasn't joined the vs room yet
            const opponentSocket = [...io.sockets.sockets.values()].find(
              s => s.data.matchId === matchId && s.id !== socket.id
            );
            if (opponentSocket) {
              matchService.forfeitMatch(matchId, socket.data.userId);
              opponentSocket.emit('opponentLeft', {});
            } else {
              matchService.forceEndMatch(matchId);
            }
          } else {
            // Forfeiting player loses — remaining player wins
            matchService.forfeitMatch(matchId, socket.data.userId);
            io.to(`vs_${matchId}`).emit('opponentLeft', {});
          }
        }
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

  const gap = oppScore - myScore;
  const prevGap = prevOppScore - prevMyScore;
  if (gap >= 5 && prevGap < 5) {
    const opponentId = sockets.find(s => s.data.userId !== scoringUserId)?.data?.userId;
    if (opponentId) {
      const msg = await aiReactionService.generateReaction('underdog', matchId + '_under_' + opponentId, { gap });
      if (msg) sendTo(opponentId, msg);
    }
  }
}
