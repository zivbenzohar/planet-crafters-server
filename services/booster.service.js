const User = require("../model/User_model");

const VALID_TYPES = ["doubleScore", "cancelPlacement", "addHex"];

async function getBoosters(userId) {
  const user = await User.findById(userId, { boosters: 1 }).lean();
  if (!user) throw new Error("User not found");
  return user.boosters ?? { doubleScore: 0, cancelPlacement: 0, addHex: 0 };
}

async function grantBooster(userId, boosterType, amount = 1) {
  if (!VALID_TYPES.includes(boosterType)) throw new Error(`Unknown booster type: ${boosterType}`);
  const field = `boosters.${boosterType}`;
  await User.updateOne({ _id: userId }, { $inc: { [field]: amount } });
  const after = await getBoosters(userId);
  console.log(`[Booster] GRANT +${amount} ${boosterType} → user ${userId} | inventory:`, after);
}

async function consumeBooster(userId, boosterType) {
  if (!VALID_TYPES.includes(boosterType)) throw new Error(`Unknown booster type: ${boosterType}`);

  const user = await User.findById(userId, { boosters: 1 }).lean();
  if (!user) throw new Error("User not found");

  const current = user.boosters?.[boosterType] ?? 0;
  if (current <= 0) throw new Error(`No ${boosterType} boosters available`);

  const field = `boosters.${boosterType}`;
  await User.updateOne({ _id: userId }, { $inc: { [field]: -1 } });
  const after = await getBoosters(userId);
  console.log(`[Booster] CONSUME -1 ${boosterType} → user ${userId} | inventory:`, after);
}

module.exports = { getBoosters, grantBooster, consumeBooster, VALID_TYPES };
