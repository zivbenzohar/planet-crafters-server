// const express = require("express");
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const router = express.Router();

// const User = require("../../model/User_model");

// // Get user by id (for debug)
// router.get("/:id", async (req, res) => {
//   try {
//     const user = await User.findById(req.params.id).select("-password");
//     if (!user) return res.status(404).json({ message: "User not found" });
//     return res.json(user);
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ message: "Server error" });
//   }
// });

// // Register user @Route: /api/users
// router.post("/", async (req, res) => {
//   const { name, email, password } = req.body;
//   console.log("req.body", req.body);

//   // validate
//   if (!name || !email || !password) {
//     return res.status(400).json({ msg: "Please fill in required details" });
//   }

//   try {
//     // check existing user
//     const existing = await User.findOne({ email });
//     if (existing) return res.status(400).json({ msg: "Email already exists" });

//     // hash password
//     const salt = await bcrypt.genSalt(10);
//     const hash = await bcrypt.hash(password, salt);

//     // create user
//     const newUser = new User({ name, email, password: hash });
//     const user = await newUser.save();

//     // create tokens
//     const accessToken = jwt.sign(
//       { id: user.id },
//       process.env.JWT_ACCESS_SECRET,
//       { expiresIn: "15m" }
//     );

//     const refreshToken = jwt.sign(
//       { id: user.id },
//       process.env.JWT_REFRESH_SECRET,
//       { expiresIn: "7d" }
//     );

//     // save refresh token
//     user.refreshToken = refreshToken;
//     await user.save();

//     // response
//     return res.json({
//       accessToken,
//       refreshToken,
//       user: {
//         id: user.id,
//         name: user.name,
//         email: user.email,
//       },
//     });
//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ msg: "Server error" });
//   }
// });

// // Delete user @Route: /api/users/:id (optional - not implemented)
// router.delete("/:id", (_req, res) => {
//   return res.status(501).json({ msg: "Not implemented" });
// });

// module.exports = router;

const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const User = require("../../model/User_model");

/**
 * GET /api/users/:id
 * (דיבאג) החזרת משתמש לפי ID בלי סיסמה
 */
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

/**
 * POST /api/users
 * Register:
 * - יוצר משתמש חדש
 * - חשוב: לא עושים bcrypt.hash כאן!
 *   כי במודל User יש pre('save') שעושה hashing אוטומטי.
 * - יוצר accessToken + refreshToken ושומר refreshToken ב-DB
 */
router.post("/", async (req, res) => {
  const { name, email, password } = req.body;
  console.log("req.body", req.body);

  // ולידציה בסיסית
  if (!name || !email || !password) {
    return res.status(400).json({ msg: "Please fill in required details" });
  }

  try {
    // נרמול מייל כדי למנוע בעיות אותיות גדולות/רווחים
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedName = String(name).trim();

    // בדיקת משתמש קיים
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ msg: "Email already exists" });

    // יצירת משתמש חדש
    // כאן password נשמר כ-plain, אבל בעת save יקרה hashing אוטומטי (pre-save)
    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password,
    });

    // יצירת טוקנים
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

    // שמירת refresh token ב-DB כדי לאמת אותו בעתיד
    user.refreshToken = refreshToken;
    await user.save(); // password לא השתנתה => לא ייעשה hashing מחדש

    // תשובה ללקוח (בלי סיסמה)
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

    // אם הוגדר unique על email במודל - לפעמים נקבל שגיאת duplicate key
    if (err.code === 11000) {
      return res.status(400).json({ msg: "Email already exists" });
    }

    return res.status(500).json({ msg: "Server error" });
  }
});

/**
 * DELETE /api/users/:id
 * (אופציונלי - לא ממומש)
 */
router.delete("/:id", (req, res) => {
  return res.status(501).json({ msg: "Not implemented" });
});

module.exports = router;
