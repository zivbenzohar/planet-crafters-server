const express = require("express");
const router = express.Router();
const HexTile = require("../../model/HexTile_model");

// GET /api/hex-tiles
router.get("/", async (req, res) => {
  try {
    const tiles = await HexTile.find().lean();
    res.json(tiles);
  } catch (e) {
    res.status(500).json({ msg: "Failed to load hex tiles" });
  }
});

module.exports = router;
