// One-time cleanup script — delete specific users and all their associated data
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../model/User_model");
const Planet = require("../model/Planet_model");
const UserAchievement = require("../model/UserAchievement_model");

const TARGET_IDS = [
  "6a10647067f31a24a0cb872b",
  "6a17324b09080e27a63f721e",
  "6a17326b09080e27a63f7227",
  "6a17d359b5b0483f31ce405d",
  "6a17d4d3b5b0483f31ce405f",
  "6a17fac3780b29c6d98c93f9",
  "6a18004c780b29c6d98c93fb",
  "6a18b288d4eeedd32e0a540b",
  "6a1979546ef530532ae537ed",
  "6a1a061109d1f166eca148ae",
  "6a1c347c1ae1509e75b24be4",
  "6a1c34e31ae1509e75b24c01",
  "6a1c461db713cddfaecc2854",
  "6a1c47e0b713cddfaecc286b",
  "6a1c5611b713cddfaecc287d",
  "6a1c564777f17fa4122148b3",
  "6a1c5b8f6960bf6894874b00",
  "6a1f25c23c49a7df225bf1dd",
  "6a1f26b3fd3a1ea8d6bc8db9",
  "6a206b28f9586f6d8c2c4811",
  "6a206eebf9586f6d8c2c483a",
  "6a206f62f9586f6d8c2c484b",
  "6a207506e0a63ea0d958d55d",
  "6a207565e0a63ea0d958d562",
  "6a209798be9659f22b47137a",
  "6a2908aca59139721a0470b5",
  "6a290b6aa59139721a04711f",
  "6a317729675d48e26289ecf1",
  "6a32474a4df5c877240c2c56",
  "6a3288a5a2f729a60d376d95",
  "6a36c8e2b5fb495fa1a9fb38",
];

const TARGET_OBJECT_IDS = TARGET_IDS.map((id) => new mongoose.Types.ObjectId(id));

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const userResult = await User.deleteMany({ _id: { $in: TARGET_OBJECT_IDS } });
  console.log(`Users deleted: ${userResult.deletedCount}`);

  const planetResult = await Planet.deleteMany({ userId: { $in: TARGET_IDS } });
  console.log(`Planets deleted: ${planetResult.deletedCount}`);

  const achievementResult = await UserAchievement.deleteMany({ userId: { $in: TARGET_IDS } });
  console.log(`UserAchievements deleted: ${achievementResult.deletedCount}`);

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
