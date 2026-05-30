var express = require("express");
var router = express.Router();

/* GET home page. */
router.get("/", function (req, res, next) {
  res.send("Hello from Express!");
});

router.use("/api/users", require("./api/users"));     // Register
router.use("/api/auth", require("./api/auth"));       // Login/refresh/logout/user
router.use("/api/hex-tiles", require("./api/hexTiles"));
router.use("/api/planets", require("./api/planet"));
router.use("/api/planet-state", require("./api/planetState"));
router.use("/api/achievements", require("./api/achievements"));
router.use("/api/matches", require("./api/match"));

module.exports = router;
