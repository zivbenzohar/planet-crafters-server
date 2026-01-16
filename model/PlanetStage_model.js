const mongoose = require("mongoose");
const { StageStateSchema } = require("./StageState_model");
const { StageMetaSchema } = require("./StageMeta_model");

const PlanetStageSchema = new mongoose.Schema(
  {
    stageId: { type: String, required: true }, // "stage_01" וכו'

    meta: { type: StageMetaSchema, default: () => ({}) },

    // זה מה שמאפשר "לחזור לכל נקודה" – נשמר אחרי כל פעולה
    state: { type: StageStateSchema, default: () => ({}) },
  },
  { _id: false }
);

module.exports = { PlanetStageSchema };
