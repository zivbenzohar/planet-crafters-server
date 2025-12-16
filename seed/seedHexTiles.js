require("dotenv").config();
const mongoose = require("mongoose");

const HexTileTemplate = require("../model/HexTile_model");

const tiles = [
  {
    type: "halfGoldRock",
    edges: ["gold", "gold", "rock", "rock", "rock", "rock"],
    texture: "hex_gold_lvl1.png",
    level: 1,
  },
  {
    type: "halfRockBio",
    edges: ["rock", "rock", "bio", "bio", "bio", "bio"],
    texture: "hex_rock_bio_lvl1.png",
    level: 1,
  },
  {
    type: "halfBioCrystal",
    edges: ["bio", "bio", "crystal", "crystal", "crystal", "crystal"],
    texture: "hex_bio_crystal_lvl1.png",
    level: 1,
  },
  {
    type: "tripleGoldTripleRock",
    edges: ["gold", "gold", "gold", "rock", "rock", "rock"],
    texture: "hex_gold_rock_3_3_lvl1.png",
    level: 1,
  },
  {
    type: "tripleBioTripleRock",
    edges: ["bio", "bio", "bio", "rock", "rock", "rock"],
    texture: "hex_bio_rock_3_3_lvl1.png",
    level: 1,
  },
  {
    type: "tripleCrystalTripleBio",
    edges: ["crystal", "crystal", "crystal", "bio", "bio", "bio"],
    texture: "hex_crystal_bio_3_3_lvl1.png",
    level: 1,
  },
  {
    type: "fourRockTwoGold",
    edges: ["rock", "rock", "rock", "rock", "gold", "gold"],
    texture: "hex_rock_gold_4_2_lvl1.png",
    level: 1,
  },
  {
    type: "fourBioTwoRock",
    edges: ["bio", "bio", "bio", "bio", "rock", "rock"],
    texture: "hex_bio_rock_4_2_lvl1.png",
    level: 1,
  },
  {
    type: "fourGoldTwoCrystal",
    edges: ["gold", "gold", "gold", "gold", "crystal", "crystal"],
    texture: "hex_gold_crystal_4_2_lvl1.png",
    level: 1,
  },
  {
    type: "allRock",
    edges: ["rock", "rock", "rock", "rock", "rock", "rock"],
    texture: "hex_rock_lvl1.png",
    level: 1,
  },
  {
    type: "allGold",
    edges: ["gold", "gold", "gold", "gold", "gold", "gold"],
    texture: "hex_gold_lvl1_full.png",
    level: 1,
  },
  {
    type: "allBio",
    edges: ["bio", "bio", "bio", "bio", "bio", "bio"],
    texture: "hex_bio_lvl1.png",
    level: 1,
  },
  {
    type: "allCrystal",
    edges: ["crystal", "crystal", "crystal", "crystal", "crystal", "crystal"],
    texture: "hex_crystal_lvl1.png",
    level: 1,
  },
  {
    type: "twoTwoTwo_mix",
    edges: ["gold", "gold", "rock", "rock", "bio", "bio"],
    texture: "hex_mix_2_2_2_lvl1.png",
    level: 1,
  },
  {
    type: "alternating_gold_rock",
    edges: ["gold", "rock", "gold", "rock", "gold", "rock"],
    texture: "hex_alt_gold_rock_lvl1.png",
    level: 1,
  },
];

// בדיקה בסיסית שכל tile תקין
function validateTiles() {
  for (const t of tiles) {
    if (!t.type || !t.texture || !Array.isArray(t.edges) || t.edges.length !== 6) {
      throw new Error("Invalid tile in seed list: " + JSON.stringify(t));
    }
  }
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("Missing MONGO_URI in .env");
  }

  validateTiles();

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB");

  // מוחקים רק את הקטלוג הישן ומכניסים חדש
  const del = await HexTileTemplate.deleteMany({});
  console.log(`🧹 Deleted hexTileTemplate docs: ${del.deletedCount}`);

  const inserted = await HexTileTemplate.insertMany(tiles);
  console.log(`✅ Inserted hex tiles: ${inserted.length}`);

  await mongoose.disconnect();
  console.log("✅ Disconnected");
}

main().catch((e) => {
  console.error("❌ seedHexTiles failed:", e);
  process.exit(1);
});
