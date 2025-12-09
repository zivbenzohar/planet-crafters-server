// seedHexTiles.js
require("dotenv").config();
const mongoose = require("mongoose");
const HexTile = require("./model/HexTile_model");

async function run() {
  try {
    const mongoURI = process.env.MONGO_URI;
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB Atlas (for seeding hex tiles)");

    // ננקה את הקולקציה הקודמת (כדי שלא יהיו כפילויות בזמן פיתוח)
    await HexTile.deleteMany({});
    console.log("🧹 Cleared hexTileTemplate collection");

const tiles = [
  {
    type: "halfGoldRock",
    edges: ["gold", "gold", "rock", "rock", "rock", "rock"],
    texture: "hex_gold_lvl1.png",
    level: 1,
    position: { q: 0, r: 0 },
  },
  {
    type: "fullGold",
    edges: ["gold", "gold", "gold", "gold", "gold", "gold"],
    texture: "hex_gold_lvl1.png",
    level: 1,
    position: { q: 1, r: 0 },
  },
  {
    type: "halfBioGold",
    edges: ["bio", "bio", "bio", "gold", "gold", "gold"],
    texture: "hex_bio_lvl1.png",
    level: 1,
    position: { q: -1, r: 1 },
  },
  {
    type: "fullBio",
    edges: ["bio", "bio", "bio", "bio", "bio", "bio"],
    texture: "hex_bio_lvl1.png",
    level: 1,
    position: { q: 0, r: 1 },
  },
  {
    type: "halfCrystalRock",
    edges: ["crystal", "crystal", "crystal", "rock", "rock", "rock"],
    texture: "hex_crystal_lvl1.png",
    level: 1,
    position: { q: 1, r: 1 },
  },
  {
    type: "mixedCrystalBio",
    edges: ["crystal", "bio", "crystal", "bio", "crystal", "bio"],
    texture: "hex_mixed_lvl1.png",
    level: 1,
    position: { q: -1, r: 0 },
  },
  {
    type: "stardustStar",
    edges: ["stardust", "stardust", "stardust", "stardust", "rock", "rock"],
    texture: "hex_stardust_lvl1.png",
    level: 1,
    position: { q: 2, r: -1 },
  },
  {
    type: "bioRockBlend",
    edges: ["bio", "rock", "bio", "rock", "bio", "rock"],
    texture: "hex_bio_lvl1.png",
    level: 1,
    position: { q: 2, r: 0 },
  },
  {
    type: "tripleElement",
    edges: ["gold", "bio", "stardust", "gold", "bio", "stardust"],
    texture: "hex_multi_lvl1.png",
    level: 1,
    position: { q: 0, r: 2 },
  },
  {
    type: "crystalGoldEdge",
    edges: ["crystal", "crystal", "gold", "gold", "crystal", "gold"],
    texture: "hex_crystal_lvl1.png",
    level: 1,
    position: { q: -2, r: 1 },
  },

  // ---- חדשים שהוספנו ----

  {
    type: "fullRock",
    edges: ["rock", "rock", "rock", "rock", "rock", "rock"],
    texture: "hex_rock_lvl1.png",
    level: 1,
    position: { q: -2, r: 0 },
  },
  {
    type: "fullCrystal",
    edges: ["crystal", "crystal", "crystal", "crystal", "crystal", "crystal"],
    texture: "hex_crystal_lvl1.png",
    level: 1,
    position: { q: -2, r: -1 },
  },
  {
    type: "fullStardust",
    edges: ["stardust", "stardust", "stardust", "stardust", "stardust", "stardust"],
    texture: "hex_stardust_lvl1.png",
    level: 1,
    position: { q: 1, r: -1 },
  },
  {
    type: "goldCrystalRing",
    edges: ["gold", "crystal", "gold", "crystal", "gold", "crystal"],
    texture: "hex_gold_crystal_lvl1.png",
    level: 1,
    position: { q: 3, r: 0 },
  },
  {
    type: "bioStardustMix",
    edges: ["bio", "bio", "stardust", "stardust", "bio", "stardust"],
    texture: "hex_bio_stardust_lvl1.png",
    level: 1,
    position: { q: 3, r: -1 },
  },
];

    const inserted = await HexTile.insertMany(tiles);
    console.log("✅ Inserted hex tiles:");
    console.log(inserted);

    process.exit(0);
  } catch (err) {
    console.error("❌ Seed error:", err);
    process.exit(1);
  }
}

run();