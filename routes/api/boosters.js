const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const { getBoosters, grantBooster, VALID_TYPES } = require("../../services/booster.service");

// GET /api/boosters — return current booster inventory
router.get("/", auth, async (req, res) => {
  try {
    const boosters = await getBoosters(String(req.user.id));
    return res.json(boosters);
  } catch (e) {
    return res.status(500).json({ msg: e.message });
  }
});

// POST /api/boosters/grant/:type — grant 1 booster (used by wheel)
router.post("/grant/:type", auth, async (req, res) => {
  try {
    const { type } = req.params;
    if (!VALID_TYPES.includes(type))
      return res.status(400).json({ msg: `Unknown booster type: ${type}` });

    await grantBooster(String(req.user.id), type, 1);
    const boosters = await getBoosters(String(req.user.id));
    return res.json(boosters);
  } catch (e) {
    return res.status(500).json({ msg: e.message });
  }
});

module.exports = router;
