// // model/HexTile_model.js
// const mongoose = require("mongoose");

// const HexTileSchema = new mongoose.Schema({
//   type: {
//     type: String,
//     required: true,
//   },
//   edges: {
//     type: [String], // מערך של 6 מחרוזות: ["gold", "rock", ...]
//     required: true,
//   },
//   texture: {
//     type: String,
//     required: true,
//   },
//   level: {
//     type: Number,
//     default: 1,
//   },
//   position: {
//     q: { type: Number, default: 0 },
//     r: { type: Number, default: 0 },
//   },
// });

// module.exports = mongoose.model("hexTileTemplate", HexTileSchema);

// model/HexTile_model.js
const mongoose = require("mongoose");

/**
 * HexTileTemplate:
 * זהו "קטלוג" של סוגי משושים קבועים (Templates).
 * חשוב: לא שומרים פה position! מיקום שייך ל-State של המשתמש (UserStageState).
 */
const HexTileSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      // לדוגמה: "halfGoldRock"
    },

    edges: {
      type: [String],
      required: true,
      // מערך של 6 מחרוזות לפי סדר קבוע של כיוונים: ["gold","gold","rock","rock","rock","rock"]
      // בהמשך: תשתמשי ב-rotation כדי לדעת איזו פאה נמצאת באיזה כיוון בפועל.
      validate: {
        validator: function (arr) {
          return Array.isArray(arr) && arr.length === 6;
        },
        message: "edges חייב להכיל בדיוק 6 ערכים",
      },
    },

    texture: {
      type: String,
      required: true,
      // שם קובץ/asset ב-Unity לדוגמה: "hex_gold_lvl1.png"
    },

    level: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

// שימי לב: שם המודל נשאר אצלך "hexTileTemplate" כדי לא לשבור דברים קיימים
module.exports = mongoose.model("hexTileTemplate", HexTileSchema);
