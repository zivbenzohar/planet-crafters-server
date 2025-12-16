const express = require("express");
const router = express.Router();

const auth = require("../../middleware/auth");
const UserStageState = require("../../model/UserStageState_model");
const buildStackForStage = require("../../services/buildStackForStage");

/**
 * GET /api/stages/:stage/state
 * - אם יש State שמור למשתמש בשלב הזה -> מחזיר אותו
 * - אם אין -> יוצר ערימה ראשונית, שומר מסמך חדש, ומחזיר אותו
 */
router.get("/:stage/state", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const stage = Number(req.params.stage);

    let state = await UserStageState.findOne({ userId, stage })
      // populate כדי שהקליינט יקבל edges/texture בלי עוד קריאות
      .populate("placedTiles.templateId")
      .populate("remainingStack.templateId");

    if (!state) {
      const remainingStack = await buildStackForStage(stage, 30);

      const created = await UserStageState.create({
        userId,
        stage,
        placedTiles: [],
        remainingStack,
      });

      state = await UserStageState.findById(created._id)
        .populate("placedTiles.templateId")
        .populate("remainingStack.templateId");
    }

    return res.json(state);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

/**
 * POST /api/stages/:stage/place
 * body: { instanceId, q, r, rotation }
 * - מוציא את המשושה הראשון מהערימה
 * - שם אותו ב-placedTiles עם מיקום וסיבוב
 * - שומר ומחזיר state מעודכן
 */
router.post("/:stage/place", auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const stage = Number(req.params.stage);
    const { instanceId, q, r, rotation = 0 } = req.body;

    if (!instanceId || q === undefined || r === undefined) {
      return res.status(400).json({ msg: "Missing instanceId/q/r" });
    }

    const state = await UserStageState.findOne({ userId, stage });
    if (!state) {
      return res.status(404).json({ msg: "State not found. Call GET /state first." });
    }

    if (state.remainingStack.length === 0) {
      return res.status(400).json({ msg: "No tiles left in stack" });
    }

    // מונע הנחה על תא תפוס
    const occupied = state.placedTiles.some((t) => t.q === q && t.r === r);
    if (occupied) {
      return res.status(409).json({ msg: "Cell already occupied" });
    }

    // מוציאים משושה ראשון מהערימה (ל-POC)
    const next = state.remainingStack.shift();

    // מוסיפים ללוח
    state.placedTiles.push({
      instanceId,
      templateId: next.templateId,
      q,
      r,
      rotation,
    });

    state.version++;
    await state.save();

    const populated = await UserStageState.findById(state._id)
      .populate("placedTiles.templateId")
      .populate("remainingStack.templateId");

    return res.json(populated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Server error", error: err.message });
  }
});

module.exports = router;
