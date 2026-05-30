const Achievement = require("../model/Achievement_model");
const UserAchievement = require("../model/UserAchievement_model");
const Planet = require("../model/Planet_model");

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
    totalCoins: null,
  };

  if (!userId || !Array.isArray(events) || events.length === 0) {
    return result;
  }

  for (const event of events) {
    if (!event?.metricKey) continue;

    const definitions = await Achievement.find({
      metricKey: event.metricKey,
      isActive: true,
    }).lean();

    for (const definition of definitions) {
      const state = await getOrCreateUserAchievement(userId, definition);
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

        const coinReward = await grantSupportedReward({
          userId,
          planetId,
          achievement: definition,
          userAchievement: state,
        });

        if (coinReward.coinsAwarded > 0) {
          result.coinsAwarded += coinReward.coinsAwarded;
          result.totalCoins = coinReward.totalCoins;
        }

        result.unlocked.push({
          id: definition.achievementId,
          title: definition.title,
          rewardType: definition.rewardType,
          rewardAmount: definition.rewardAmount,
          rewardGranted: state.rewardGranted,
        });
      }

      await state.save();
    }
  }

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
    return { coinsAwarded: 0, totalCoins: null };
  }

  const rewardType = String(achievement.rewardType || "").toLowerCase();
  const rewardAmount = Number(achievement.rewardAmount || 0);

  if (rewardType !== "coins" || rewardAmount <= 0 || !planetId) {
    return { coinsAwarded: 0, totalCoins: null };
  }

  const updatedPlanet = await Planet.findOneAndUpdate(
    { userId, planetId },
    { $inc: { totalCoins: rewardAmount } },
    { new: true, projection: { totalCoins: 1 } }
  ).lean();

  userAchievement.rewardGranted = true;
  userAchievement.rewardGrantedAt = new Date();

  return {
    coinsAwarded: rewardAmount,
    totalCoins: updatedPlanet?.totalCoins ?? null,
  };
}

module.exports = {
  getAchievementsForUser,
  evaluateAchievementEvents,
};
