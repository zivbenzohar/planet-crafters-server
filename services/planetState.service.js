const Planet = require("../model/Planet_model");
const HexTile = require("../model/HexTile_model");

function emptyStageState() {
  return {
    map: { placedTiles: [] },
    hand: { maxHandSize: 3, tilesInHand: [] },
    deck: { remainingTiles: [] },
    progress: { developedPercent: 0, score: 0, isCompleted: false },
  };
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function createDeckAndHand(deckSize, handSize = 3) {
  const tiles = await HexTile.find({}, { _id: 1 }).lean();
  if (!tiles.length) throw new Error("No HexTile templates");

  const ids = tiles.map(t => String(t._id));
  const pack = Array.from({ length: deckSize }, () => randomPick(ids));

  return {
    hand: {
      maxHandSize: handSize,
      tilesInHand: pack.slice(0, handSize),
    },
    deck: {
      remainingTiles: pack.slice(handSize),
    },
  };
}

async function getStageState({ userId, planetId, stageId, deckSize }) {
  const planet = await Planet.findOne(
    { userId, planetId, "stages.stageId": stageId },
    { stages: { $elemMatch: { stageId } }, planetId: 1 }
  ).lean();

  if (!planet || !planet.stages.length) {
    throw new Error("Stage not found");
  }

  const stage = planet.stages[0];
  let state = stage.state || emptyStageState();

  const hasDeck =
    state.deck &&
    Array.isArray(state.deck.remainingTiles) &&
    state.deck.remainingTiles.length > 0;

  if (!hasDeck) {
    const { hand, deck } = await createDeckAndHand(deckSize);

    state = { ...state, hand, deck };

    await Planet.updateOne(
      { userId, planetId, "stages.stageId": stageId },
      {
        $set: {
          "stages.$.state": state,
          "stages.$.meta.isStarted": true,
          "stages.$.meta.lastPlayedAt": new Date(),
        },
      }
    );
  }

  return {
    planetId,
    stageId,
    meta: stage.meta,
    state,
  };
}

async function saveStageState({ userId, planetId, stageId, state }) {
  if (!state?.hand || !state?.deck) {
    throw new Error("Invalid state: hand/deck required");
  }

  const updated = await Planet.findOneAndUpdate(
    { userId, planetId, "stages.stageId": stageId },
    {
      $set: {
        "stages.$.state": state,
        "stages.$.meta.lastPlayedAt": new Date(),
      },
    },
    { new: true, projection: { stages: { $elemMatch: { stageId } } } }
  ).lean();

  if (!updated || !updated.stages.length) {
    throw new Error("Stage not found");
  }

  return {
    planetId,
    stageId,
    meta: updated.stages[0].meta,
    state: updated.stages[0].state,
  };
}

async function resetStageState({ userId, planetId, stageId }) {
  const emptyState = {
    map: { placedTiles: [] },
    hand: { maxHandSize: 3, tilesInHand: [] },
    deck: { remainingTiles: [] },
    progress: { developedPercent: 0, score: 0, isCompleted: false },
  };

  const updated = await Planet.findOneAndUpdate(
    { userId, planetId, "stages.stageId": stageId },
    {
      $set: {
        "stages.$.state": emptyState,
        "stages.$.meta.isStarted": false,
        "stages.$.meta.lastPlayedAt": null,
      },
    },
    { new: true, projection: { stages: { $elemMatch: { stageId } } } }
  ).lean();

  if (!updated || !updated.stages?.length) {
    throw new Error("Stage not found");
  }

  return {
    planetId,
    stageId,
    ...emptyState,
  };
}

module.exports = {
  getStageState,
  saveStageState,
  resetStageState, // 👈 חדש
};