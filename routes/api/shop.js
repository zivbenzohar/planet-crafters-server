const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const { getShopProfile, buyAvatar, buyBooster, setSelectedAvatar, addCoins } = require("../../services/shop.service");

// GET /api/shop/profile
router.get("/profile", auth, async (req, res) => {
  try {
    const profile = await getShopProfile(String(req.user.id));
    return res.json(profile);
  } catch (e) {
    return res.status(500).json({ msg: e.message });
  }
});

// POST /api/shop/buy/avatar/:avatarId
router.post("/buy/avatar/:avatarId", auth, async (req, res) => {
  try {
    const result = await buyAvatar(String(req.user.id), req.params.avatarId);
    if (!result.success) return res.json(result);
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ msg: e.message });
  }
});

// POST /api/shop/buy/booster/:type
router.post("/buy/booster/:type", auth, async (req, res) => {
  try {
    const result = await buyBooster(String(req.user.id), req.params.type);
    if (!result.success) return res.json(result);
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ msg: e.message });
  }
});

// PUT /api/shop/avatar
router.put("/avatar", auth, async (req, res) => {
  try {
    const { avatarId } = req.body;
    if (!avatarId) return res.status(400).json({ msg: "avatarId required" });
    const result = await setSelectedAvatar(String(req.user.id), avatarId);
    if (!result.success) return res.json(result);
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ msg: e.message });
  }
});

// POST /api/shop/add-coins
router.post("/add-coins", auth, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ msg: "Invalid amount" });
    const total = await addCoins(String(req.user.id), amount);
    return res.json({ coins: total });
  } catch (e) {
    return res.status(500).json({ msg: e.message });
  }
});

module.exports = router;
