const crypto = require('crypto');
const Planet = require('../model/Planet_model');
const { createDeckAndHand } = require('./planetState.service');

const matches = {};

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

async function createMatch(userId, planetId, stageId, duration = 180) {
  const matchId = generateId();
  const code = generateCode();

  const match = {
    matchId,
    code,
    status: 'waiting',
    duration,
    startTime: null,
    players: [{ userId, planetId, stageId, score: 0, finished: false }],
    winnerId: undefined,
  };

  matches[matchId] = match;
  matches[`code:${code}`] = matchId;

  return match;
}

async function joinMatch(code, userId, planetId, stageId) {
  const matchId = matches[`code:${code}`];
  if (!matchId) throw new Error('Room not found');

  const match = matches[matchId];
  if (!match) throw new Error('Room not found');
  if (match.status !== 'waiting') throw new Error('Room already started');
  if (match.players.find(p => p.userId === userId)) throw new Error('Already in this room');
  if (match.players.length >= 2) throw new Error('Room is full');

  match.players.push({ userId, planetId, stageId, score: 0, finished: false });

  // Create stages and deck BEFORE marking as active — if this fails, match stays 'waiting'
  const matchStageId = `match_${matchId}`;
  match.matchStageId = matchStageId;

  // Generate one shared deck so both players get identical tiles
  const { hand, deck } = await createDeckAndHand(30, 3, { level: 1 });
  const sharedState = {
    map: { placedTiles: [] },
    hand,
    deck,
    progress: { developedPercent: 0, score: 0, isCompleted: false },
  };

  for (const player of match.players) {
    await Planet.updateOne(
      {
        userId: player.userId,
        planetId: player.planetId,
        'stages.stageId': { $ne: matchStageId },
      },
      {
        $push: {
          stages: {
            stageId: matchStageId,
            meta: {
              coord: { q: 0, r: 0 },
              level: 1,
              resourceType: 'terra',
              isUnlocked: true,
              isStarted: false,
              isCompleted: false,
              isMatchStage: true,
            },
            state: sharedState,
          },
        },
      }
    );
  }

  // Only mark active after stages are successfully created
  match.status = 'active';
  match.startTime = null;

  return match;
}

function getMatch(matchId) {
  const match = matches[matchId];
  if (!match) throw new Error('Match not found');

  if (match.status === 'active' && match.startTime !== null) {
    const elapsed = (Date.now() - match.startTime) / 1000;
    if (elapsed >= match.duration) {
      _endMatch(match);
    }
  }

  return match;
}

function playerReady(matchId, userId) {
  const match = matches[matchId];
  if (!match) throw new Error('Match not found');

  const player = match.players.find(p => p.userId === userId);
  if (!player) throw new Error('Player not in match');

  player.ready = true;

  if (match.players.length === 2 && match.players.every(p => p.ready)) {
    match.startTime = Date.now();
  }

  return match;
}

function updateScore(matchId, userId, score) {
  const match = matches[matchId];
  if (!match) throw new Error('Match not found');

  const player = match.players.find(p => p.userId === userId);
  if (!player) throw new Error('Player not in match');

  player.score = score;
  return match;
}

function submitFinalScore(matchId, userId, finalScore) {
  const match = matches[matchId];
  if (!match) throw new Error('Match not found');

  const player = match.players.find(p => p.userId === userId);
  if (!player) throw new Error('Player not in match');

  player.score = finalScore;
  player.finished = true;

  const allFinished = match.players.length === 2 && match.players.every(p => p.finished);
  const timeUp = match.startTime && (Date.now() - match.startTime) / 1000 >= match.duration;

  if (allFinished || timeUp) {
    _endMatch(match);
  }

  return match;
}

function _endMatch(match) {
  if (match.status === 'finished') return;
  match.status = 'finished';

  if (match.players.length < 2) {
    match.winnerId = match.players[0]?.userId ?? null;
  } else {
    const [p1, p2] = match.players;
    if (p1.score > p2.score) match.winnerId = p1.userId;
    else if (p2.score > p1.score) match.winnerId = p2.userId;
    else match.winnerId = null;
  }

  // Award +1 coin to winner's planet
  if (match.winnerId) {
    const winner = match.players.find(p => p.userId === match.winnerId);
    if (winner) {
      Planet.updateOne(
        { userId: winner.userId, planetId: winner.planetId },
        { $inc: { totalCoins: 1 } }
      ).catch(err => console.error('[Match] Award coin error:', err));
    }
  }

  // Clean up temporary match stages from each player's planet
  if (match.matchStageId) {
    for (const player of match.players) {
      Planet.updateOne(
        { userId: player.userId, planetId: player.planetId },
        { $pull: { stages: { stageId: match.matchStageId } } }
      ).catch(err => console.error('[Match] Cleanup stage error:', err));
    }
  }
}

// Clean up finished matches after 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of Object.entries(matches)) {
    if (key.startsWith('code:')) continue;
    if (value.status === 'finished' && now - (value.startTime || now) > 10 * 60 * 1000) {
      delete matches[`code:${value.code}`];
      delete matches[key];
    }
  }
}, 60 * 1000);

module.exports = { createMatch, joinMatch, getMatch, playerReady, updateScore, submitFinalScore };
