require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const Achievement = require("../model/Achievement_model");
const {
  inferMetricKey,
  getProgressMode,
  getTrigger,
} = require("../services/achievementCatalog");

function defaultJsonPath() {
  return path.resolve(
    process.cwd(),
    "../../planet-crafters-unity/Assets/Resources/JSON/Achievements.json"
  );
}

async function run() {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    throw new Error("MONGO_URI is missing from .env");
  }

  const jsonPath = process.argv[2] || process.env.ACHIEVEMENTS_JSON_PATH || defaultJsonPath();
  const raw = fs.readFileSync(jsonPath, "utf8");
  const parsed = JSON.parse(raw);
  const achievements = Array.isArray(parsed.achievements) ? parsed.achievements : [];

  if (achievements.length === 0) {
    throw new Error(`No achievements found in ${jsonPath}`);
  }

  await mongoose.connect(mongoURI);

  const activeIds = achievements.map(a => a.id);

  // Deactivate achievements removed from the JSON
  await Achievement.updateMany(
    { achievementId: { $nin: activeIds } },
    { $set: { isActive: false } }
  );

  const operations = achievements.map(achievement => {
    const metricKey = inferMetricKey(achievement);

    return {
      updateOne: {
        filter: { achievementId: achievement.id },
        update: {
          $set: {
            achievementId: achievement.id,
            title: achievement.title,
            description: achievement.description,
            category: achievement.category,
            targetValue: achievement.targetValue,
            rewardType: achievement.rewardType,
            rewardAmount: achievement.rewardAmount,
            metricKey,
            progressMode: getProgressMode(metricKey),
            trigger: getTrigger(metricKey),
            isActive: true,
          },
        },
        upsert: true,
      },
    };
  });

  const result = await Achievement.bulkWrite(operations, { ordered: false });
  console.log(`Seeded ${achievements.length} achievements from ${jsonPath}`);
  console.log(`Inserted: ${result.upsertedCount}, modified: ${result.modifiedCount}`);

  await mongoose.disconnect();
}

run().catch(async err => {
  console.error("seedAchievements failed:", err);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore disconnect errors during failure cleanup
  }
  process.exit(1);
});
