const express = require("express");
const router = express.Router();

const auth = require("../../middleware/auth");
const UserStageState = require("../../model/UserStageState_model");
const buildStackForStage = require("../../services/buildStackForStage");

const toDto = (state) => ({
  stageId: state.stageId,
  map: state.map,
  hand: state.hand,
  deck: state.deck,
  progress: state.progress,
});

// נורמליזציה: לוודא שמערכים הם string[]
const normalizeIds = (arr) =>
  Array.isArray(arr) ? arr.map((x) => String(x)).filter(Boolean) : [];

/**
 * GET /api/stages/:stageId/state
 * Load (ואם אין עדיין state -> יצירה ראשונית)
 */
router.get("/:stageId/state", auth, async (req, res) => {
  const userId = String(req.user.id);
  const stageId = String(req.params.stageId);

  let state = await UserStageState.findOne({ userId, stageId });

  if (!state) {
    const rawTiles = await buildStackForStage(stageId, 30);
    const tiles = Array.isArray(rawTiles)
      ? rawTiles
          .map((t) =>
            typeof t === "string"
              ? t
              : String(t?.templateId ?? t?._id ?? t)
          )
          .filter(Boolean)
      : [];

    const maxHandSize = 3;

    state = await UserStageState.create({
      userId,
      stageId,
      map: { placedTiles: [] },
      hand: { maxHandSize, tilesInHand: tiles.slice(0, maxHandSize) },
      deck: { remainingTiles: tiles.slice(maxHandSize) },
      progress: { developedPercent: 0, score: 0, isCompleted: false },
    });
  }

  res.json(toDto(state));
});

/**
 * PUT /api/stages/:stageId/state
 * Save מלא (קוראים לזה בכל הנחה)
 */
router.put("/:stageId/state", auth, async (req, res) => {
  const userId = String(req.user.id);
  const stageId = String(req.params.stageId);

  const { map, hand, deck, progress } = req.body;

  if (!map || !hand || !deck || !progress) {
    return res.status(400).json({ msg: "Missing map/hand/deck/progress" });
  }

  const placedTiles = Array.isArray(map.placedTiles) ? map.placedTiles : [];

  const tilesInHand = normalizeIds(hand.tilesInHand);
  const remainingTiles = normalizeIds(deck.remainingTiles);

  const maxHandSize = Number(hand.maxHandSize ?? 3);

  const saved = await UserStageState.findOneAndUpdate(
    { userId, stageId },
    {
      $set: {
        map: { placedTiles },
        hand: { maxHandSize, tilesInHand },
        deck: { remainingTiles },
        progress: {
          developedPercent: Number(progress.developedPercent ?? 0),
          score: Number(progress.score ?? 0),
          isCompleted: Boolean(progress.isCompleted ?? false),
        },
      },
    },
    { new: true, upsert: true, runValidators: true }
  );

  res.json(toDto(saved));
});

/**
 * POST /api/stages/:stageId/reset
 * מחיקה מלאה של כל נתוני השלב למשתמש (מסמך נמחק)
 */
router.post("/:stageId/reset", auth, async (req, res) => {
  const userId = String(req.user.id);
  const stageId = String(req.params.stageId);

  await UserStageState.deleteOne({ userId, stageId });

  // מחזירים ok. הלקוח יכול לקרוא GET /state כדי להתחיל מחדש.
  res.json({ ok: true });
});

module.exports = router;
