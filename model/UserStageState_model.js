const mongoose = require("mongoose");

/**
 * משושה שמונח על הלוח.
 * שומרים templateId + מיקום (q,r) + rotation.
 * זה מספיק כדי לחשב בעתיד חיבורים/נקודות בין פאות.
 */
const PlacedTileSchema = new mongoose.Schema(
  {
    instanceId: { type: String, required: true }, // מזהה מהקליינט (Unity)
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "hexTileTemplate", // חשוב: זה שם המודל שלך
      required: true,
    },
    q: { type: Number, required: true },
    r: { type: Number, required: true },
    rotation: { type: Number, default: 0 }, // 0..5
    placedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * פריט בערימה (שעדיין לא הונח).
 * שומרים רק templateId לפי סדר.
 */
const StackItemSchema = new mongoose.Schema(
  {
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "hexTileTemplate",
      required: true,
    },
  },
  { _id: false }
);

const UserStageStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user", // חשוב: זה שם המודל שלך
      required: true,
      index: true,
    },
    stage: { type: Number, required: true, index: true },

    placedTiles: { type: [PlacedTileSchema], default: [] },
    remainingStack: { type: [StackItemSchema], default: [] },

    handSize: { type: Number, default: 3 },
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// לכל משתמש+שלב יש State יחיד
UserStageStateSchema.index({ userId: 1, stage: 1 }, { unique: true });

module.exports = mongoose.model("userStageState", UserStageStateSchema);
