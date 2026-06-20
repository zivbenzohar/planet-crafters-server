// routes/api/planets.js
const express = require("express");
const router = express.Router();

const auth = require("../../middleware/auth");
const { getOrCreateActivePlanet } = require("../../services/planet.service");
const { enqueuePreGen } = require("../../services/planetState.service");
const User = require("../../model/User_model");

/**
 * GET /api/planets/active
 */
router.get("/active", auth, async (req, res) => {
  try {
    const userId = String(req.user.id);

    const [{ planet, wasCreated }, user] = await Promise.all([
      getOrCreateActivePlanet({ userId, planetId: "planet_01", totalStages: 37 }),
      User.findById(userId).select("coins").lean(),
    ]);

    if (wasCreated) {
      const unlockedStages = planet.stages.filter(s => s.meta?.isUnlocked && !s.meta?.isStarted);
      for (const s of unlockedStages) {
        enqueuePreGen({ userId, planetId: planet.planetId, stageId: s.stageId });
      }
    }

    const normalStages = planet.stages.filter(s => !s.meta?.isMatchStage);
    const completedStages = normalStages.filter(s => s.meta?.isCompleted).length;

    return res.json({
      planetId: planet.planetId,
      stages: normalStages,
      totalCoins: user?.coins ?? 0,
      playerLevel: completedStages + 1,
    });
  } catch (e) {
    console.error("GET ACTIVE PLANET ERROR:", e);
    return res.status(500).json({ msg: "Server error" });
  }
});

/**
 * POST /api/planets/:planetId/add-coins
 */
router.post("/:planetId/add-coins", auth, async (req, res) => {
  try {
    const userId = String(req.user.id);
    const { planetId } = req.params;
    const { amount } = req.body;

    if (!amount || amount <= 0)
      return res.status(400).json({ msg: "amount must be positive" });

    const Planet = require("../../model/Planet_model");
    await Planet.updateOne({ userId, planetId }, { $inc: { totalCoins: amount } });
    const planet = await Planet.findOne({ userId, planetId }, { totalCoins: 1 }).lean();

    console.log(`[Coins] +${amount} → user ${userId} planet ${planetId} | total: ${planet.totalCoins}`);
    return res.json({ totalCoins: planet.totalCoins });
  } catch (e) {
    console.error("ADD-COINS error:", e);
    return res.status(500).json({ msg: e.message });
  }
});

module.exports = router;
