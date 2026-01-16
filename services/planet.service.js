// services/planet.service.js
const Planet = require("../model/Planet_model");

/* =========================
   Hex grid helpers (axial)
   ========================= */

const DIRS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

function add(a, b) {
  return { q: a.q + b.q, r: a.r + b.r };
}

function scale(d, k) {
  return { q: d.q * k, r: d.r * k };
}

// מחזיר טבעת radius סביב center (6*radius תאים)
function axialRing(center, radius) {
  if (radius === 0) return [center];

  let hex = add(center, scale(DIRS[4], radius));
  const results = [];

  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      results.push(hex);
      hex = add(hex, DIRS[side]);
    }
  }
  return results;
}

/* =========================
   Planet stages seeding
   ========================= */

function stageIdByIndex(i) {
  return `stage_${String(i + 1).padStart(2, "0")}`;
}

function emptyStageState() {
  return {
    map: { placedTiles: [] },
    hand: { maxHandSize: 3, tilesInHand: [] },
    deck: { remainingTiles: [] },
    progress: { developedPercent: 0, score: 0, isCompleted: false },
  };
}

function createInitialStagesWithCoords(totalStages = 19) {
  const center = { q: 0, r: 0 };

  // אוספים coords טבעת אחרי טבעת עד שיש totalStages
  const coords = [center];
  let radius = 1;

  while (coords.length < totalStages) {
    const ring = axialRing(center, radius);
    for (const c of ring) {
      if (coords.length >= totalStages) break;
      coords.push(c);
    }
    radius++;
  }

  // בונים stages[]
  return coords.map((c, i) => ({
    stageId: stageIdByIndex(i),
    meta: {
      coord: { q: c.q, r: c.r },
      isUnlocked: i === 0,
      isStarted: false,
      isCompleted: false,
      lastPlayedAt: null,
    },
    state: emptyStageState(),
  }));
}

/* =========================
   Public service API
   ========================= */

async function getOrCreateActivePlanet({
  userId,
  planetId = "planet_01",
  totalStages = 19,
}) {
  let planet = await Planet.findOne({ userId, planetId }).lean();

  // אם אין כדור — יוצרים עם stages
  if (!planet) {
    const created = await Planet.create({
      userId,
      planetId,
      stages: createInitialStagesWithCoords(totalStages),
    });
    planet = created.toObject();
  }

  // אם יש אבל stages חסר/ריק — מאתחלים
  if (!Array.isArray(planet.stages) || planet.stages.length === 0) {
    planet = await Planet.findOneAndUpdate(
      { userId, planetId },
      { $set: { stages: createInitialStagesWithCoords(totalStages) } },
      { new: true }
    ).lean();
  }

  return planet;
}

module.exports = {
  // main
  getOrCreateActivePlanet,

  // optional exports (אם תרצי להשתמש בדברים האלה בעוד מקומות)
  createInitialStagesWithCoords,
  emptyStageState,

  // hex helpers (רק אם תרצי להשתמש בהמשך)
  axialRing,
  add,
  scale,
  DIRS,
};
