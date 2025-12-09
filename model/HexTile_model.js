// model/HexTile_model.js
const mongoose = require("mongoose");

const HexTileSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
  },
  edges: {
    type: [String], // מערך של 6 מחרוזות: ["gold", "rock", ...]
    required: true,
  },
  texture: {
    type: String,
    required: true,
  },
  level: {
    type: Number,
    default: 1,
  },
  position: {
    q: { type: Number, default: 0 },
    r: { type: Number, default: 0 },
  },
});

module.exports = mongoose.model("hexTileTemplate", HexTileSchema);