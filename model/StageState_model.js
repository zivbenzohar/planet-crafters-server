// models/schemas/stageState.schemas.js
const mongoose = require("mongoose");

/**
 * Tile שמונח על המפה
 */
const PlacedTileSchema = new mongoose.Schema(
  {
    coord: {
      q: { type: Number, required: true },
      r: { type: Number, required: true },
    },
    rotation: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    tileId: {
      type: String, // ID של template / tile
      required: true,
    },
  },
  { _id: false }
);

/**
 * מצב משחק "חי" של שלב (מה שמתעדכן אחרי כל פעולה)
 */
const StageStateSchema = new mongoose.Schema(
  {
    map: {
      placedTiles: {
        type: [PlacedTileSchema],
        default: [],
      },
    },

    hand: {
      maxHandSize: { type: Number, default: 3 },
      tilesInHand: { type: [String], default: [] }, // tileIds
    },

    deck: {
      remainingTiles: { type: [String], default: [] }, // tileIds
    },

    progress: {
      developedPercent: { type: Number, default: 0, min: 0, max: 100 },
      score: { type: Number, default: 0 },
      isCompleted: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

module.exports = { PlacedTileSchema, StageStateSchema };
