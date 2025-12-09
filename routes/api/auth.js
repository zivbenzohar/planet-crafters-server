const express = require("express");
const bcrypt = require("bcryptjs");
const config = require("config");
const jwt = require("jsonwebtoken");
const router = express.Router();
const auth = require("../../middleware/auth");

const User = require("../../model/User_model");

// Check authentic user
router.post("/", (req, res) => {
  const { email, password } = req.body;

  //validate
  if (!email || !password) {
    return res.status(400).json({ msg: "Please fill in required details" });
  }

  User.findOne({ email }).then((user) => {
    if (!user) return res.status(400).json({ msg: "User does not exists" });

    bcrypt
      .compare(password, user.password)
      .then((isMatched) => {
        if (!isMatched) res.status(400).json({ msg: "Invalid Credentials" });

        jwt.sign(
          { id: user.id },
          config.get("jwtSecret"),
          { expiresIn: 3600 },
          (err, token) => {
            if (err) throw err;
            res.json({
              token,
              user: {
                id: user.id,
                name: user.name,
                email: user.email,
                isAdmin: user.isAdmin,
              },
            });
          }
        );
      })
      .catch((err) =>
        res.status(400).json({ msg: "Please enter correct password" })
      );
  });
});

// Get authentic user
router.get("/user", auth, (req, res) => {
  User.findById(req.user.id)
    .select("-password")
    .then((user) => res.json(user));
});
module.exports = router;
