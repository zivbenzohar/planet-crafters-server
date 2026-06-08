const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const { getWheelStatus, consumeSpin, grantSpin } = require("../../services/wheel.service");

// GET /api/wheel/status
router.get("/status", auth, async (req, res) => {
  try {
    const status = await getWheelStatus(String(req.user.id));
    return res.json(status);
  } catch (e) {
    return res.status(500).json({ msg: e.message });
  }
});

// POST /api/wheel/spin
router.post("/spin", auth, async (req, res) => {
  try {
    const result = await consumeSpin(String(req.user.id));
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ msg: e.message });
  }
});

// POST /api/wheel/grant-spin
router.post("/grant-spin", auth, async (req, res) => {
  try {
    const result = await grantSpin(String(req.user.id), 1);
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ msg: e.message });
  }
});

module.exports = router;
