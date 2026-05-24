require("dotenv").config();
const mongoose = require("mongoose");

const HexTileTemplate = require("../model/HexTile_model");

const R = "rock", C = "crystal", B = "bio", T = "terra";

const tiles = [
  // ========================= Category 1 — Mono (4) — Level 1 =========================
  { type: "allRock",    edges: [R,R,R,R,R,R], level: 1 },
  { type: "allCrystal", edges: [C,C,C,C,C,C], level: 1 },
  { type: "allBio",     edges: [B,B,B,B,B,B], level: 1 },
  { type: "allTerra",   edges: [T,T,T,T,T,T], level: 1 },

  // ========================= Category 2 — 4+2 Contiguous (AAAABB) (12) — Level 1 =========================
  { type: "moreRockCrystal",  edges: [R,R,R,R,C,C], level: 1 },
  { type: "moreRockBio",      edges: [R,R,R,R,B,B], level: 1 },
  { type: "moreRockTerra",    edges: [R,R,R,R,T,T], level: 1 },
  { type: "moreCrystalRock",  edges: [C,C,C,C,R,R], level: 1 },
  { type: "moreCrystalBio",   edges: [C,C,C,C,B,B], level: 1 },
  { type: "moreCrystalTerra", edges: [C,C,C,C,T,T], level: 1 },
  { type: "moreBioRock",      edges: [B,B,B,B,R,R], level: 1 },
  { type: "moreBioCrystal",   edges: [B,B,B,B,C,C], level: 1 },
  { type: "moreBioTerra",     edges: [B,B,B,B,T,T], level: 1 },
  { type: "moreTerraRock",    edges: [T,T,T,T,R,R], level: 1 },
  { type: "moreTerraCrystal", edges: [T,T,T,T,C,C], level: 1 },
  { type: "moreTerraBio",     edges: [T,T,T,T,B,B], level: 1 },

  // ========================= Category 3 — 4+2 Non-Contiguous A (AAABAB) (12) — Level 2 =========================
  { type: "altA_moreRockCrystal",  edges: [R,R,R,C,R,C], level: 2 },
  { type: "altA_moreRockBio",      edges: [R,R,R,B,R,B], level: 2 },
  { type: "altA_moreRockTerra",    edges: [R,R,R,T,R,T], level: 2 },
  { type: "altA_moreCrystalRock",  edges: [C,C,C,R,C,R], level: 2 },
  { type: "altA_moreCrystalBio",   edges: [C,C,C,B,C,B], level: 2 },
  { type: "altA_moreCrystalTerra", edges: [C,C,C,T,C,T], level: 2 },
  { type: "altA_moreBioRock",      edges: [B,B,B,R,B,R], level: 2 },
  { type: "altA_moreBioCrystal",   edges: [B,B,B,C,B,C], level: 2 },
  { type: "altA_moreBioTerra",     edges: [B,B,B,T,B,T], level: 2 },
  { type: "altA_moreTerraRock",    edges: [T,T,T,R,T,R], level: 2 },
  { type: "altA_moreTerraCrystal", edges: [T,T,T,C,T,C], level: 2 },
  { type: "altA_moreTerraBio",     edges: [T,T,T,B,T,B], level: 2 },

  // ========================= Category 4 — 4+2 Non-Contiguous B (AABAAB) (12) — Level 2 =========================
  { type: "altB_moreRockCrystal",  edges: [R,R,C,R,R,C], level: 2 },
  { type: "altB_moreRockBio",      edges: [R,R,B,R,R,B], level: 2 },
  { type: "altB_moreRockTerra",    edges: [R,R,T,R,R,T], level: 2 },
  { type: "altB_moreCrystalRock",  edges: [C,C,R,C,C,R], level: 2 },
  { type: "altB_moreCrystalBio",   edges: [C,C,B,C,C,B], level: 2 },
  { type: "altB_moreCrystalTerra", edges: [C,C,T,C,C,T], level: 2 },
  { type: "altB_moreBioRock",      edges: [B,B,R,B,B,R], level: 2 },
  { type: "altB_moreBioCrystal",   edges: [B,B,C,B,B,C], level: 2 },
  { type: "altB_moreBioTerra",     edges: [B,B,T,B,B,T], level: 2 },
  { type: "altB_moreTerraRock",    edges: [T,T,R,T,T,R], level: 2 },
  { type: "altB_moreTerraCrystal", edges: [T,T,C,T,T,C], level: 2 },
  { type: "altB_moreTerraBio",     edges: [T,T,B,T,T,B], level: 2 },

  // ========================= Category 5 — 3+3 Contiguous (AAABBB) (6) — Level 2 =========================
  { type: "halfRockCrystal",  edges: [R,R,R,C,C,C], level: 2 },
  { type: "halfRockBio",      edges: [R,R,R,B,B,B], level: 2 },
  { type: "halfRockTerra",    edges: [R,R,R,T,T,T], level: 2 },
  { type: "halfCrystalBio",   edges: [C,C,C,B,B,B], level: 2 },
  { type: "halfCrystalTerra", edges: [C,C,C,T,T,T], level: 2 },
  { type: "halfBioTerra",     edges: [B,B,B,T,T,T], level: 2 },

  // ========================= Category 6 — 3+3 Non-Contiguous A (AABABB) (6) — Level 2 =========================
  { type: "altA_halfRockCrystal",  edges: [R,R,C,R,C,C], level: 3 },
  { type: "altA_halfRockBio",      edges: [R,R,B,R,B,B], level: 3 },
  { type: "altA_halfRockTerra",    edges: [R,R,T,R,T,T], level: 3 },
  { type: "altA_halfCrystalBio",   edges: [C,C,B,C,B,B], level: 3 },
  { type: "altA_halfCrystalTerra", edges: [C,C,T,C,T,T], level: 3 },
  { type: "altA_halfBioTerra",     edges: [B,B,T,B,T,T], level: 3 },

  // ========================= Category 7 — 3+3 Non-Contiguous B (AABBAB) (6) — Level 2 =========================
  { type: "altB_halfRockCrystal",  edges: [R,R,C,C,R,C], level: 3 },
  { type: "altB_halfRockBio",      edges: [R,R,B,B,R,B], level: 3 },
  { type: "altB_halfRockTerra",    edges: [R,R,T,T,R,T], level: 3 },
  { type: "altB_halfCrystalBio",   edges: [C,C,B,B,C,B], level: 3 },
  { type: "altB_halfCrystalTerra", edges: [C,C,T,T,C,T], level: 3 },
  { type: "altB_halfBioTerra",     edges: [B,B,T,T,B,T], level: 3 },

  // ========================= Category 8 — 3+3 Non-Contiguous C (ABABAB) (6) — Level 3 =========================
  { type: "altC_halfRockCrystal",  edges: [R,C,R,C,R,C], level: 3 },
  { type: "altC_halfRockBio",      edges: [R,B,R,B,R,B], level: 3 },
  { type: "altC_halfRockTerra",    edges: [R,T,R,T,R,T], level: 3 },
  { type: "altC_halfCrystalBio",   edges: [C,B,C,B,C,B], level: 3 },
  { type: "altC_halfCrystalTerra", edges: [C,T,C,T,C,T], level: 3 },
  { type: "altC_halfBioTerra",     edges: [B,T,B,T,B,T], level: 3 },
];

function validateTiles() {
  if (tiles.length !== 64) throw new Error(`Expected 64 tiles, got ${tiles.length}`);
  for (const t of tiles) {
    if (!t.type || !Array.isArray(t.edges) || t.edges.length !== 6) {
      throw new Error("Invalid tile: " + JSON.stringify(t));
    }
  }
}

async function main() {
  if (!process.env.MONGO_URI) throw new Error("Missing MONGO_URI in .env");

  validateTiles();

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB");

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
