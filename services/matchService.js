const crypto = require('crypto');
const Planet = require('../model/Planet_model');
const User = require('../model/User_model');
const { createDeckAndHand } = require('./planetState.service');
const { evaluateAchievementEvents } = require('./achievement.service');

const matches = {};

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateId() {
  return crypto.randomBytes(16).toString('hex');
}

function getMatchRaw(matchId) {
  return matches[matchId] ?? null;
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

  _endMatch(match);

  return match;
}

function _endMatch(match) {
  if (match.status === 'finished') return;
  match.status = 'finished';

  if (match.winnerId === undefined) {
    if (match.players.length < 2) {
      match.winnerId = match.players[0]?.userId ?? null;
    } else {
      const [p1, p2] = match.players;
      if (p1.score > p2.score) match.winnerId = p1.userId;
      else if (p2.score > p1.score) match.winnerId = p2.userId;
      else match.winnerId = null;
    }
  }

  if (match.winnerId) {
    User.updateOne(
      { _id: match.winnerId },
      { $inc: { coins: 2 } }
    ).catch(err => console.error('[Match] Award coin error:', err));
  }

  match._achievementsPromise = recordFinishedMatchAchievements(match)
    .then(byPlayer => { match.achievementsByPlayer = byPlayer; })
    .catch(err => console.error('[Match] Achievement update error:', err))
    .finally(() => { match._achievementsPromise = null; });

  if (match.matchStageId) {
    for (const player of match.players) {
      Planet.updateOne(
        { userId: player.userId, planetId: player.planetId },
        { $pull: { stages: { stageId: match.matchStageId } } }
      ).catch(err => console.error('[Match] Cleanup stage error:', err));
    }
  }
}

async function recordFinishedMatchAchievements(match) {
  const byPlayer = {};

  for (const player of match.players) {
    const won = match.winnerId === player.userId;

    const events = [
      { metricKey: 'multi.matches_played', mode: 'inc', value: 1 },
    ];

    if (won) {
      events.push({ metricKey: 'multi.matches_won', mode: 'inc', value: 1 });
    }

    const UserAchievement = require('../model/UserAchievement_model');
    const streakDoc = await UserAchievement.findOne({
      userId: player.userId,
      achievementId: { $in: ['multi_008', 'multi_009', 'multi_010'] },
    }).sort({ progress: -1 }).lean();

    const currentStreak = streakDoc?.progress ?? 0;
    const newStreak = won ? currentStreak + 1 : 0;
    if (newStreak > 0) {
      events.push({ metricKey: 'multi.win_streak', mode: 'max', value: newStreak });
    } else {
      await UserAchievement.updateMany(
        { userId: player.userId, achievementId: { $in: ['multi_008', 'multi_009', 'multi_010'] }, completed: false },
        { $set: { progress: 0 } }
      );
    }

    const result = await evaluateAchievementEvents({
      userId: player.userId,
      planetId: player.planetId,
      events,
    });

    byPlayer[player.userId] = result.unlocked ?? [];
  }

  return byPlayer;
}

// Clean up finished matches after 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of Object.entries(matches)) {
    if (key.startsWith('code:')) continue;
    if (value.status === 'finished' && now - (value.startTime || (now - 11 * 60 * 1000)) > 10 * 60 * 1000) {
      delete matches[`code:${value.code}`];
      delete matches[key];
    }
  }
}, 60 * 1000);

async function createMatchForTwo(player1, player2, duration = 180) {
  const matchId = generateId();
  const code = generateCode();
  const matchStageId = `match_${matchId}`;

  const match = {
    matchId, code, status: 'active',
    duration, startTime: null, matchStageId,
    players: [
      { userId: player1.userId, username: player1.username || player1.userId, planetId: player1.planetId, stageId: player1.stageId, score: 0, finished: false, ready: false },
      { userId: player2.userId, username: player2.username || player2.userId, planetId: player2.planetId, stageId: player2.stageId, score: 0, finished: false, ready: false },
    ],
    winnerId: undefined,
  };

  matches[matchId] = match;
  matches[`code:${code}`] = matchId;

  const { hand, deck } = await createDeckAndHand(30, 3, { level: 1 });
  const sharedState = {
    map: { placedTiles: [] }, hand, deck,
    progress: { developedPercent: 0, score: 0, isCompleted: false },
  };

  for (const player of match.players) {
    await Planet.updateOne(
      { userId: player.userId, planetId: player.planetId, 'stages.stageId': { $ne: matchStageId } },
      { $push: { stages: { stageId: matchStageId, meta: { coord: { q: 0, r: 0 }, level: 1, resourceType: 'terra', isUnlocked: true, isStarted: false, isCompleted: false, isMatchStage: true }, state: sharedState } } }
    );
  }

  return match;
}

function endMatchByTimeout(matchId) {
  const match = matches[matchId];
  if (!match || match.status !== 'active') return;
  _endMatch(match);
}

function forceEndMatch(matchId) {
  const match = matches[matchId];
  if (match) _endMatch(match);
}

function forfeitMatch(matchId, forfeitingUserId) {
  const match = matches[matchId];
  if (!match || match.status !== 'active') return;
  const winner = match.players.find(p => p.userId !== forfeitingUserId);
  if (winner) match.winnerId = winner.userId;
  _endMatch(match);
}

module.exports = {
  getMatchRaw, playerReady, updateScore, submitFinalScore,
  createMatchForTwo, forceEndMatch, forfeitMatch, endMatchByTimeout,
};
