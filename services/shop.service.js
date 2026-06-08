const User = require("../model/User_model");
const Planet = require("../model/Planet_model");
const { AVATAR_CATALOG, AVATAR_MAP } = require("../config/avatarCatalog");

const BOOSTER_PRICE = 20;
const VALID_BOOSTERS = ["doubleScore", "cancelPlacement", "addHex"];

async function getCompletedStages(userId) {
  const planet = await Planet.findOne({ userId, planetId: "planet_01" }, { stages: 1 }).lean();
  if (!planet) return 0;
  return planet.stages.filter(s => !s.meta?.isMatchStage && s.meta?.isCompleted).length;
}

async function getShopProfile(userId) {
  const [user, completedStages] = await Promise.all([
    User.findById(userId).select("coins selectedAvatar ownedAvatars boosters"),
    getCompletedStages(userId),
  ]);
  if (!user) throw new Error("User not found");

  const owned = new Set(user.ownedAvatars ?? ["avatar"]);

  // Auto-grant stage avatars the player has earned
  const toGrant = AVATAR_CATALOG
    .filter(a => a.unlockType === "stage" && completedStages >= a.stageRequired && !owned.has(a.id))
    .map(a => a.id);

  if (toGrant.length > 0) {
    await User.updateOne({ _id: userId }, { $addToSet: { ownedAvatars: { $each: toGrant } } });
    toGrant.forEach(id => owned.add(id));
  }

  return {
    coins: user.coins ?? 0,
    selectedAvatar: user.selectedAvatar ?? "avatar",
    ownedAvatars: [...owned],
    boosters: user.boosters ?? { doubleScore: 0, cancelPlacement: 0, addHex: 0 },
    completedStages,
    catalog: AVATAR_CATALOG,
  };
}

async function buyAvatar(userId, avatarId) {
  const avatarDef = AVATAR_MAP[avatarId];
  if (!avatarDef) throw new Error(`Unknown avatar: ${avatarId}`);

  if (avatarDef.unlockType === "default")
    return { success: false, reason: "already_owned" };

  if (avatarDef.unlockType === "stage")
    return { success: false, reason: "stage_unlock", stageRequired: avatarDef.stageRequired };

  const user = await User.findById(userId).select("coins ownedAvatars");
  if (!user) throw new Error("User not found");

  const owned = user.ownedAvatars ?? ["avatar"];
  if (owned.includes(avatarId))
    return { success: false, reason: "already_owned" };

  const coins = user.coins ?? 0;
  if (coins < avatarDef.price)
    return { success: false, reason: "insufficient_coins", coins };

  await User.updateOne(
    { _id: userId },
    { $inc: { coins: -avatarDef.price }, $addToSet: { ownedAvatars: avatarId } }
  );

  return { success: true, coins: coins - avatarDef.price, ownedAvatars: [...owned, avatarId] };
}

async function buyBooster(userId, boosterType) {
  if (!VALID_BOOSTERS.includes(boosterType))
    throw new Error(`Unknown booster type: ${boosterType}`);

  const user = await User.findById(userId).select("coins boosters");
  if (!user) throw new Error("User not found");

  const coins = user.coins ?? 0;
  if (coins < BOOSTER_PRICE)
    return { success: false, reason: "insufficient_coins", coins };

  const field = `boosters.${boosterType}`;
  await User.updateOne({ _id: userId }, { $inc: { coins: -BOOSTER_PRICE, [field]: 1 } });

  return {
    success: true,
    coins: coins - BOOSTER_PRICE,
    boosters: { ...user.boosters.toObject(), [boosterType]: (user.boosters[boosterType] ?? 0) + 1 },
  };
}

async function setSelectedAvatar(userId, avatarId) {
  const user = await User.findById(userId).select("ownedAvatars");
  if (!user) throw new Error("User not found");

  const owned = user.ownedAvatars ?? ["avatar"];
  if (!owned.includes(avatarId))
    return { success: false, reason: "not_owned" };

  await User.updateOne({ _id: userId }, { $set: { selectedAvatar: avatarId } });
  return { success: true, selectedAvatar: avatarId };
}

async function addCoins(userId, amount) {
  await User.updateOne({ _id: userId }, { $inc: { coins: amount } });
  const user = await User.findById(userId).select("coins");
  return user.coins ?? 0;
}

module.exports = { getShopProfile, buyAvatar, buyBooster, setSelectedAvatar, addCoins, BOOSTER_PRICE };
