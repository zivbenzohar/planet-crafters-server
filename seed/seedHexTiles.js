require("dotenv").config();
const mongoose = require("mongoose");

const HexTileTemplate = require("../model/HexTile_model");

const tiles = [
  // =========================
  // Category 1 — Mono (W1): 4 tiles
  // =========================
  { "type": "allRock",  "center": "rock",  "edges": ["rock","rock","rock","rock","rock","rock"],   "level": 1 },
  { "type": "allWater", "center": "water", "edges": ["water","water","water","water","water","water"], "level": 1 },
  { "type": "allBio",   "center": "bio",   "edges": ["bio","bio","bio","bio","bio","bio"],           "level": 1 },
  { "type": "allLava",  "center": "lava",  "edges": ["lava","lava","lava","lava","lava","lava"],     "level": 1 },

  // =========================
  // Category 2 — Bi 4+2 Contiguous [A,A,A,A,B,B] (W2): 12 tiles
  // =========================
  { "type": "moreRockWater",  "center": "rock",  "edges": ["rock","rock","rock","rock","water","water"], "level": 1 },
  { "type": "moreRockBio",    "center": "rock",  "edges": ["rock","rock","rock","rock","bio","bio"],     "level": 1 },
  { "type": "moreRockLava",   "center": "rock",  "edges": ["rock","rock","rock","rock","lava","lava"],   "level": 1 },
  { "type": "moreWaterRock",  "center": "water", "edges": ["water","water","water","water","rock","rock"], "level": 1 },
  { "type": "moreWaterBio",   "center": "water", "edges": ["water","water","water","water","bio","bio"],   "level": 1 },
  { "type": "moreWaterLava",  "center": "water", "edges": ["water","water","water","water","lava","lava"], "level": 1 },
  { "type": "moreBioRock",    "center": "bio",   "edges": ["bio","bio","bio","bio","rock","rock"],   "level": 1 },
  { "type": "moreBioWater",   "center": "bio",   "edges": ["bio","bio","bio","bio","water","water"], "level": 1 },
  { "type": "moreBioLava",    "center": "bio",   "edges": ["bio","bio","bio","bio","lava","lava"],   "level": 1 },
  { "type": "moreLavaRock",   "center": "lava",  "edges": ["lava","lava","lava","lava","rock","rock"],   "level": 1 },
  { "type": "moreLavaWater",  "center": "lava",  "edges": ["lava","lava","lava","lava","water","water"], "level": 1 },
  { "type": "moreLavaBio",    "center": "lava",  "edges": ["lava","lava","lava","lava","bio","bio"],     "level": 1 },

  // =========================
  // Category 3 — Bi 4+2 Non-Contiguous Pattern A [A,A,A,B,A,B] (W3): 12 tiles
  // =========================
  { "type": "altA_moreRockWater",  "center": "rock",  "edges": ["rock","rock","rock","water","rock","water"],   "level": 1 },
  { "type": "altA_moreRockBio",    "center": "rock",  "edges": ["rock","rock","rock","bio","rock","bio"],       "level": 1 },
  { "type": "altA_moreRockLava",   "center": "rock",  "edges": ["rock","rock","rock","lava","rock","lava"],     "level": 1 },
  { "type": "altA_moreWaterRock",  "center": "water", "edges": ["water","water","water","rock","water","rock"],   "level": 1 },
  { "type": "altA_moreWaterBio",   "center": "water", "edges": ["water","water","water","bio","water","bio"],     "level": 1 },
  { "type": "altA_moreWaterLava",  "center": "water", "edges": ["water","water","water","lava","water","lava"],   "level": 1 },
  { "type": "altA_moreBioRock",    "center": "bio",   "edges": ["bio","bio","bio","rock","bio","rock"],   "level": 1 },
  { "type": "altA_moreBioWater",   "center": "bio",   "edges": ["bio","bio","bio","water","bio","water"], "level": 1 },
  { "type": "altA_moreBioLava",    "center": "bio",   "edges": ["bio","bio","bio","lava","bio","lava"],   "level": 1 },
  { "type": "altA_moreLavaRock",   "center": "lava",  "edges": ["lava","lava","lava","rock","lava","rock"],   "level": 1 },
  { "type": "altA_moreLavaWater",  "center": "lava",  "edges": ["lava","lava","lava","water","lava","water"], "level": 1 },
  { "type": "altA_moreLavaBio",    "center": "lava",  "edges": ["lava","lava","lava","bio","lava","bio"],     "level": 1 },

  // =========================
  // Category 4 — Bi 4+2 Non-Contiguous Pattern B [A,A,B,A,A,B] (W3): 12 tiles
  // =========================
  { "type": "altB_moreRockWater",  "center": "rock",  "edges": ["rock","rock","water","rock","rock","water"],   "level": 1 },
  { "type": "altB_moreRockBio",    "center": "rock",  "edges": ["rock","rock","bio","rock","rock","bio"],       "level": 1 },
  { "type": "altB_moreRockLava",   "center": "rock",  "edges": ["rock","rock","lava","rock","rock","lava"],     "level": 1 },
  { "type": "altB_moreWaterRock",  "center": "water", "edges": ["water","water","rock","water","water","rock"],   "level": 1 },
  { "type": "altB_moreWaterBio",   "center": "water", "edges": ["water","water","bio","water","water","bio"],     "level": 1 },
  { "type": "altB_moreWaterLava",  "center": "water", "edges": ["water","water","lava","water","water","lava"],   "level": 1 },
  { "type": "altB_moreBioRock",    "center": "bio",   "edges": ["bio","bio","rock","bio","bio","rock"],   "level": 1 },
  { "type": "altB_moreBioWater",   "center": "bio",   "edges": ["bio","bio","water","bio","bio","water"], "level": 1 },
  { "type": "altB_moreBioLava",    "center": "bio",   "edges": ["bio","bio","lava","bio","bio","lava"],   "level": 1 },
  { "type": "altB_moreLavaRock",   "center": "lava",  "edges": ["lava","lava","rock","lava","lava","rock"],   "level": 1 },
  { "type": "altB_moreLavaWater",  "center": "lava",  "edges": ["lava","lava","water","lava","lava","water"], "level": 1 },
  { "type": "altB_moreLavaBio",    "center": "lava",  "edges": ["lava","lava","bio","lava","lava","bio"],     "level": 1 },

  // =========================
  // Category 5 — Bi 3+3 Contiguous [A,A,A,B,B,B] (W2): 6 tiles
  // =========================
  { "type": "halfRockWater",  "center": "rock",  "edges": ["rock","rock","rock","water","water","water"], "level": 1 },
  { "type": "halfRockBio",    "center": "rock",  "edges": ["rock","rock","rock","bio","bio","bio"],       "level": 1 },
  { "type": "halfRockLava",   "center": "rock",  "edges": ["rock","rock","rock","lava","lava","lava"],    "level": 1 },
  { "type": "halfWaterBio",   "center": "water", "edges": ["water","water","water","bio","bio","bio"],    "level": 1 },
  { "type": "halfWaterLava",  "center": "water", "edges": ["water","water","water","lava","lava","lava"], "level": 1 },
  { "type": "halfBioLava",    "center": "bio",   "edges": ["bio","bio","bio","lava","lava","lava"],       "level": 1 },

  // =========================
  // Category 6 — Bi 3+3 Non-Contiguous Pattern A [A,A,B,A,B,B] (W3): 6 tiles
  // =========================
  { "type": "altA_halfRockWater",  "center": "rock",  "edges": ["rock","rock","water","rock","water","water"],   "level": 1 },
  { "type": "altA_halfRockBio",    "center": "rock",  "edges": ["rock","rock","bio","rock","bio","bio"],         "level": 1 },
  { "type": "altA_halfRockLava",   "center": "rock",  "edges": ["rock","rock","lava","rock","lava","lava"],      "level": 1 },
  { "type": "altA_halfWaterBio",   "center": "water", "edges": ["water","water","bio","water","bio","bio"],      "level": 1 },
  { "type": "altA_halfWaterLava",  "center": "water", "edges": ["water","water","lava","water","lava","lava"],   "level": 1 },
  { "type": "altA_halfBioLava",    "center": "bio",   "edges": ["bio","bio","lava","bio","lava","lava"],         "level": 1 },

  // =========================
  // Category 7 — Bi 3+3 Non-Contiguous Pattern B [A,A,B,B,A,B] (W3): 6 tiles
  // =========================
  { "type": "altB_halfRockWater",  "center": "rock",  "edges": ["rock","rock","water","water","rock","water"],   "level": 1 },
  { "type": "altB_halfRockBio",    "center": "rock",  "edges": ["rock","rock","bio","bio","rock","bio"],         "level": 1 },
  { "type": "altB_halfRockLava",   "center": "rock",  "edges": ["rock","rock","lava","lava","rock","lava"],      "level": 1 },
  { "type": "altB_halfWaterBio",   "center": "water", "edges": ["water","water","bio","bio","water","bio"],      "level": 1 },
  { "type": "altB_halfWaterLava",  "center": "water", "edges": ["water","water","lava","lava","water","lava"],   "level": 1 },
  { "type": "altB_halfBioLava",    "center": "bio",   "edges": ["bio","bio","lava","lava","bio","lava"],         "level": 1 },

  // =========================
  // Category 8 — Bi 3+3 Non-Contiguous Pattern C [A,B,A,B,A,B] (W3): 6 tiles
  // =========================
  { "type": "altC_halfRockWater",  "center": "rock",  "edges": ["rock","water","rock","water","rock","water"],   "level": 1 },
  { "type": "altC_halfRockBio",    "center": "rock",  "edges": ["rock","bio","rock","bio","rock","bio"],         "level": 1 },
  { "type": "altC_halfRockLava",   "center": "rock",  "edges": ["rock","lava","rock","lava","rock","lava"],      "level": 1 },
  { "type": "altC_halfWaterBio",   "center": "water", "edges": ["water","bio","water","bio","water","bio"],      "level": 1 },
  { "type": "altC_halfWaterLava",  "center": "water", "edges": ["water","lava","water","lava","water","lava"],   "level": 1 },
  { "type": "altC_halfBioLava",    "center": "bio",   "edges": ["bio","lava","bio","lava","bio","lava"],         "level": 1 },
]


// Basic validation that every tile is valid
function validateTiles() {
  for (const t of tiles) {
    if (!t.type || !t.center || !Array.isArray(t.edges) || t.edges.length !== 6) {
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

  // Delete only the old catalog and insert new
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
