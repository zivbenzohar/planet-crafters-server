const express = require("express");
const router = express.Router();

const auth = require("../../middleware/auth");
const { getAchievementsForUser } = require("../../services/achievement.service");

router.get("/", auth, async (req, res) => {
  try {
    const userId = String(req.user.id);
    const achievements = await getAchievementsForUser(userId);

    return res.json({ achievements });
  } catch (e) {
    console.error("GET achievements error:", e);
    return res.status(500).json({ msg: e.message });
  }
});

module.exports = router;
