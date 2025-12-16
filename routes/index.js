var express = require("express");
var router = express.Router();

/* GET home page. */
router.get("/", function (req, res, next) {
  res.send("Hello from Express!");
});

router.use("/api/users", require("./api/users"));     // Register
router.use("/api/auth", require("./api/auth"));       // Login/refresh/logout/user
router.use("/api/stages", require("./api/stageState"));// Stage state & place

module.exports = router;


module.exports = router;
