const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();

const User = require("../../model/User_model");

// Get user by id (for debug)
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(user);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Register user @Route: /api/users
router.post("/", async (req, res) => {
  const { name, email, password } = req.body;
  console.log("req.body", req.body);

  // validate
  if (!name || !email || !password) {
    return res.status(400).json({ msg: "Please fill in required details" });
  }

  try {
    // check existing user
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: "Email already exists" });

    // hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // create user
    const newUser = new User({ name, email, password: hash });
    const user = await newUser.save();

    // create tokens
    const accessToken = jwt.sign(
      { id: user.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    // save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    // response
    return res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Server error" });
  }
});

// Delete user @Route: /api/users/:id (optional - not implemented)
router.delete("/:id", (req, res) => {
  return res.status(501).json({ msg: "Not implemented" });
});

module.exports = router;
