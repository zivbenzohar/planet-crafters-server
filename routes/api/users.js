const express = require("express");
const bcrypt = require("bcryptjs");
const config = require("config");
const jwt = require("jsonwebtoken");
const router = express.Router();

//Item model
const User = require("../../model/User_model");

//git user
router.get("/:id", (req, res) => {
  User.findById(req.params.id)
    .then((user) => {
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    })
    .catch((err) => res.status(500).json({ message: "Server error" }));
});

//Add a User @Route: /api/users
router.post("/", (req, res) => {
  const { name, email, password } = req.body;
  console.log("req.body", req.body);
  //validate
  if (!name || !email || !password) {
    return res.status(400).json({ msg: "Please fill in required details" });
  }

  User.findOne({ email }).then((user) => {
    console.log("user", user);
    if (user) return res.status(400).json({ msg: "Email already exists" });
    const newUser = new User({ name, email, password });
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(newUser.password, salt, (err, hash) => {
        if (err) throw err;
        newUser.password = hash;
        newUser.save().then((user) => {
          jwt.sign(
            {
              id: user.id,
            },
            config.get("jwtSecret"),
            {
              expiresIn: 3600, //1hour
            },
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
        });
      });
    });
  });
});

//Delete a User @Route: /api/users/:id
router.delete("/:id", (req, res) => {});

module.exports = router;
