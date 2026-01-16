const express = require("express");
const router = express.Router();

const auth = require("../../middleware/auth");

const {
  getStageState,
  saveStageState,
  resetStageState,
} = require("../../services/planetState.service");

// GET stage state (עם יצירה אם צריך)
// GET stage state (בלי meta, ובפורמט "שטוח")
router.get("/:planetId/:stageId", auth, async (req, res) => {
  try {
    const { planetId, stageId } = req.params;
    const userId = String(req.user.id);
    const deckSize = Number(req.query.deckSize || 30);

    const result = await getStageState({ userId, planetId, stageId, deckSize });

    // result מגיע כ: { planetId, stageId, meta, state }
    const state = result.state || {};

    return res.json({
      planetId: result.planetId,
      stageId: result.stageId,
      map: state.map,
      hand: state.hand,
      deck: state.deck,
      progress: state.progress, // אם את רוצה גם progress, אם לא — תמחקי
    });
  } catch (e) {
    console.error("GET planetState error:", e);
    return res.status(500).json({ msg: e.message });
  }
});


// PUT save stage state
router.put("/:planetId/:stageId", auth, async (req, res) => {
  try {
    const { planetId, stageId } = req.params;
    const userId = String(req.user.id);
    const { state } = req.body;

    const result = await saveStageState({ userId, planetId, stageId, state });
    const saved = result.state || {};

    return res.json({
      planetId: result.planetId,
      stageId: result.stageId,
      map: saved.map,
      hand: saved.hand,
      deck: saved.deck,
      progress: saved.progress, // אופציונלי
    });
  } catch (e) {
    console.error("PUT planetState error:", e);
    return res.status(500).json({ msg: e.message });
  }
});

router.post("/:planetId/:stageId/reset", auth, async (req, res) => {
  try {
    const { planetId, stageId } = req.params;
    const userId = String(req.user.id);

    const result = await resetStageState({ userId, planetId, stageId });

    return res.json(result);
  } catch (e) {
    console.error("RESET planetState error:", e);
    return res.status(500).json({ msg: e.message });
  }
});


module.exports = router;
