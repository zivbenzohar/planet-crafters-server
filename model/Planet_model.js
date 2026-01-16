// models/Planet_model.js
const mongoose = require("mongoose");
const { PlanetStageSchema } = require("./PlanetStage_model");

const PlanetSchema = new mongoose.Schema(
  {
    userId: {
      type: String, // מגיע מה-JWT
      required: true,
      index: true,
    },

    planetId: {
      type: String, // "planet_01" או UUID
      required: true,
      index: true,
    },

    stages: {
      type: [PlanetStageSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// כוכב אחד לכל userId+planetId
PlanetSchema.index({ userId: 1, planetId: 1 }, { unique: true });

// (אופציונלי אבל מומלץ) מאיץ חיפוש לפי stageId בתוך מערך
PlanetSchema.index({ userId: 1, planetId: 1, "stages.stageId": 1 });

module.exports = mongoose.model("Planet", PlanetSchema);
