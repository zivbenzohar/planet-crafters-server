const Achievement = require("../model/Achievement_model");
const UserAchievement = require("../model/UserAchievement_model");
const User = require("../model/User_model");

// In-memory cache for achievement definitions (static config, never changes at runtime)
const _defCache = new Map(); // metricKey → Definition[]
let _defCacheReady = false;

async function _warmDefinitionCache() {
  if (_defCacheReady) return;
  const defs = await Achievement.find({ isActive: true }).lean();
  for (const d of defs) {
    if (!_defCache.has(d.metricKey)) _defCache.set(d.metricKey, []);
    _defCache.get(d.metricKey).push(d);
  }
  _defCacheReady = true;
}

async function getAchievementsForUser(userId) {
  const [definitions, progressRows] = await Promise.all([
    Achievement.find({ isActive: true }).sort({ category: 1, achievementId: 1 }).lean(),
    UserAchievement.find({ userId }).lean(),
  ]);

  const progressById = new Map(progressRows.map(row => [row.achievementId, row]));

  return definitions.map(definition => {
    const progress = progressById.get(definition.achievementId);

    return {
      id: definition.achievementId,
      title: definition.title,
      description: definition.description,
      category: definition.category,
      targetValue: definition.targetValue,
      rewardType: definition.rewardType,
      rewardAmount: definition.rewardAmount,
      currentProgress: progress?.progress ?? 0,
      isCompleted: progress?.completed ?? false,
      rewardGranted: progress?.rewardGranted ?? false,
    };
  });
}

async function evaluateAchievementEvents({ userId, planetId, events = [] }) {
  const result = {
    unlocked: [],
    coinsAwarded: 0,
    userCoins: null,
  };

  if (!userId || !Array.isArray(events) || events.length === 0) {
    return result;
  }

  const validEvents = events.filter(e => e?.metricKey);
  if (validEvents.length === 0) return result;

  // Use cached achievement definitions (avoids a DB query on every tile placement)
  await _warmDefinitionCache();
  const metricKeys = [...new Set(validEvents.map(e => e.metricKey))];
  const allDefinitions = metricKeys.flatMap(k => _defCache.get(k) ?? []);

  if (allDefinitions.length === 0) return result;

  // Single query for all existing user achievement records
  const achievementIds = allDefinitions.map(d => d.achievementId);
  const existingStates = await UserAchievement.find({
    userId,
    achievementId: { $in: achievementIds },
  });

  const stateMap = new Map(existingStates.map(s => [s.achievementId, s]));

  // Group definitions by metricKey for fast lookup
  const definitionsByKey = new Map();
  for (const def of allDefinitions) {
    if (!definitionsByKey.has(def.metricKey)) definitionsByKey.set(def.metricKey, []);
    definitionsByKey.get(def.metricKey).push(def);
  }

  // Process all events in memory
  const statesToSave = [];
  let totalCoinsToAward = 0;

  for (const event of validEvents) {
    const definitions = definitionsByKey.get(event.metricKey) ?? [];
    for (const definition of definitions) {
      let state = stateMap.get(definition.achievementId);
      if (!state) {
        state = new UserAchievement({
          userId,
          achievementId: definition.achievementId,
          rewardType: definition.rewardType,
          rewardAmount: definition.rewardAmount,
        });
        stateMap.set(definition.achievementId, state);
      }

      const previousProgress = state.progress ?? 0;
      const nextProgress = calculateNextProgress(state, definition, event);
      if (nextProgress !== previousProgress) {
        state.progress = nextProgress;
      }

      const justCompleted = !state.completed && state.progress >= definition.targetValue;
      if (justCompleted) {
        state.completed = true;
        state.completedAt = new Date();
        state.rewardType = definition.rewardType;
        state.rewardAmount = definition.rewardAmount;

        const rewardType = String(definition.rewardType || "").toLowerCase();
        const rewardAmount = Number(definition.rewardAmount || 0);
        if (rewardType === "coins" && rewardAmount > 0 && !state.rewardGranted) {
          totalCoinsToAward += rewardAmount;
          state.rewardGranted = true;
          state.rewardGrantedAt = new Date();
        }

        result.unlocked.push({
          id: definition.achievementId,
          title: definition.title,
          rewardType: definition.rewardType,
          rewardAmount: definition.rewardAmount,
          rewardGranted: state.rewardGranted,
        });
      }

      if (!statesToSave.includes(state)) statesToSave.push(state);
    }
  }

  // Single coin update if any rewards earned
  if (totalCoinsToAward > 0) {
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId },
      { $inc: { coins: totalCoinsToAward } },
      { new: true, projection: { coins: 1 } }
    ).lean();
    result.coinsAwarded = totalCoinsToAward;
    result.userCoins = updatedUser?.coins ?? null;
  }

  // Parallel saves
  await Promise.all(statesToSave.map(s => s.save()));

  return result;
}

async function getOrCreateUserAchievement(userId, definition) {
  let state = await UserAchievement.findOne({
    userId,
    achievementId: definition.achievementId,
  });

  if (state) return state;

  return new UserAchievement({
    userId,
    achievementId: definition.achievementId,
    rewardType: definition.rewardType,
    rewardAmount: definition.rewardAmount,
  });
}

function calculateNextProgress(state, definition, event) {
  const mode = event.mode || definition.progressMode || "inc";
  const current = state.progress ?? 0;

  if (mode === "max") {
    return Math.max(current, Number(event.value || 0));
  }

  if (mode === "unique") {
    const uniqueValue = event.uniqueValue == null ? "" : String(event.uniqueValue);
    if (!uniqueValue) return current;

    const values = state.uniqueValues ?? [];
    if (!values.includes(uniqueValue)) {
      values.push(uniqueValue);
      state.uniqueValues = values;
    }

    return values.length;
  }

  return current + Number(event.value || 1);
}

async function grantSupportedReward({ userId, planetId, achievement, userAchievement }) {
  if (userAchievement.rewardGranted) {
    return { coinsAwarded: 0, userCoins: null };
  }

  const rewardType = String(achievement.rewardType || "").toLowerCase();
  const rewardAmount = Number(achievement.rewardAmount || 0);

  if (rewardType !== "coins" || rewardAmount <= 0) {
    return { coinsAwarded: 0, userCoins: null };
  }

  const updatedUser = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { coins: rewardAmount } },
    { new: true, projection: { coins: 1 } }
  ).lean();

  userAchievement.rewardGranted = true;
  userAchievement.rewardGrantedAt = new Date();

  return {
    coinsAwarded: rewardAmount,
    userCoins: updatedUser?.coins ?? null,
  };
}

module.exports = {
  getAchievementsForUser,
  evaluateAchievementEvents,
};
