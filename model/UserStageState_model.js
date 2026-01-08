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
 * State של משתמש בשלב
 */
const UserStageStateSchema = new mongoose.Schema(
  {
    userId: {
      type: String,            // מגיע מה-JWT
      required: true,
      index: true,
    },

    stageId: {
      type: String,
      required: true,
      index: true,
    },

    map: {
      placedTiles: {
        type: [PlacedTileSchema],
        default: [],
      },
    },

    hand: {
      maxHandSize: {
        type: Number,
        default: 3,
      },
      tilesInHand: {
        type: [String],        // 🔹 רשימת tileId-ים
        default: [],
      },
    },

    deck: {
      remainingTiles: {
        type: [String],        // 🔹 רשימת tileId-ים
        default: [],
      },
    },

    progress: {
      developedPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      score: {
        type: Number,
        default: 0,
      },
      isCompleted: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

// לכל משתמש + שלב יש State אחד
UserStageStateSchema.index(
  { userId: 1, stageId: 1 },
  { unique: true }
);

module.exports = mongoose.model(
  "UserStageState",
  UserStageStateSchema
);
