const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const matchService = require('../../services/matchService');


// POST /api/matches/create
router.post('/create', auth, async (req, res) => {
  try {
    const userId = String(req.user.id);
    const { planetId, stageId, duration } = req.body;

    if (!planetId || !stageId)
      return res.status(400).json({ msg: 'planetId and stageId required' });

    const match = await matchService.createMatch(userId, planetId, stageId, duration);
    res.json({ ...match, myUserId: userId });
  } catch (e) {
    res.status(500).json({ msg: e.message });
  }
});

// POST /api/matches/join
router.post('/join', auth, async (req, res) => {
  try {
    const userId = String(req.user.id);
    const { code, planetId, stageId } = req.body;

    if (!code || !planetId || !stageId)
      return res.status(400).json({ msg: 'code, planetId and stageId required' });

    const match = await matchService.joinMatch(code.toUpperCase(), userId, planetId, stageId);
    res.json({ ...match, myUserId: userId });
  } catch (e) {
    const clientMsg = ['not found', 'already started', 'already in', 'full'];
    const isClient = clientMsg.some(m => e.message.toLowerCase().includes(m));
    res.status(isClient ? 400 : 500).json({ msg: e.message });
  }
});

// GET /api/matches/:matchId
router.get('/:matchId', auth, (req, res) => {
  try {
    const userId = String(req.user.id);
    const match = matchService.getMatch(req.params.matchId);
    res.json({ ...match, myUserId: userId });
  } catch (e) {
    res.status(404).json({ msg: e.message });
  }
});

// POST /api/matches/:matchId/ready
router.post('/:matchId/ready', auth, (req, res) => {
  try {
    const userId = String(req.user.id);
    const match = matchService.playerReady(req.params.matchId, userId);
    res.json({ ...match, myUserId: userId });
  } catch (e) {
    res.status(400).json({ msg: e.message });
  }
});

// POST /api/matches/:matchId/score
router.post('/:matchId/score', auth, (req, res) => {
  try {
    const userId = String(req.user.id);
    const { score } = req.body;
    const match = matchService.updateScore(req.params.matchId, userId, score ?? 0);
    res.json(match);
  } catch (e) {
    res.status(400).json({ msg: e.message });
  }
});

// POST /api/matches/:matchId/finish
router.post('/:matchId/finish', auth, (req, res) => {
  try {
    const userId = String(req.user.id);
    const { finalScore } = req.body;

    const match = matchService.submitFinalScore(req.params.matchId, userId, finalScore ?? 0);
    res.json(match);
  } catch (e) {
    res.status(400).json({ msg: e.message });
  }
});

module.exports = router;
