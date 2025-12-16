// // const express = require("express");
// // const bcrypt = require("bcryptjs");
// // //const config = require("config");
// // const jwt = require("jsonwebtoken");
// // const router = express.Router();
// // const auth = require("../../middleware/auth");

// // const User = require("../../model/User_model");

// // // Check authentic user
// // router.post("/", (req, res) => {
// //   const { email, password } = req.body;

// //   //validate
// //   if (!email || !password) {
// //     return res.status(400).json({ msg: "Please fill in required details" });
// //   }

// //   User.findOne({ email }).then((user) => {
// //     if (!user) return res.status(400).json({ msg: "User does not exists" });

// //     bcrypt
// //       .compare(password, user.password)
// //       .then((isMatched) => {
// //         if (!isMatched) res.status(400).json({ msg: "Invalid Credentials" });

// //         jwt.sign(
// //           { id: user.id },
// //           process.env.JWT_SECRET,
// //           { expiresIn: 3600 },
// //           (err, token) => {
// //             if (err) throw err;
// //             res.json({
// //               token,
// //               user: {
// //                 id: user.id,
// //                 name: user.name,
// //                 email: user.email,
// //                 isAdmin: user.isAdmin,
// //               },
// //             });
// //           }
// //         );
// //       })
// //       .catch((err) =>
// //         res.status(400).json({ msg: "Please enter correct password" })
// //       );
// //   });
// // });

// // // Get authentic user
// // router.get("/user", auth, (req, res) => {
// //   User.findById(req.user.id)
// //     .select("-password")
// //     .then((user) => res.json(user));
// // });
// // module.exports = router;



// const express = require("express");
// const bcrypt = require("bcryptjs");
// //const config = require("config");
// const jwt = require("jsonwebtoken");
// const router = express.Router();
// const auth = require("../../middleware/auth");

// const User = require("../../model/User_model");

// // Check authentic user
// router.post("/", async (req, res) => {
//   const { email, password } = req.body;

//   if (!email || !password) {
//     return res.status(400).json({ msg: "Please fill in required details" });
//   }

//   try {
//     const user = await User.findOne({ email });
//     if (!user) return res.status(401).json({ msg: "Invalid credentials" });

//     const isMatched = await bcrypt.compare(password, user.password);
//     if (!isMatched) return res.status(401).json({ msg: "Invalid credentials" });

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

//     user.refreshToken = refreshToken;
//     await user.save();

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

// // Get authentic user
// router.get("/user", auth, (req, res) => {
//   User.findById(req.user.id)
//     .select("-password")
//     .then((user) => res.json(user));
// });
// router.post("/refresh", async (req, res) => {
//   const { refreshToken } = req.body;
//   if (!refreshToken) return res.status(401).json({ msg: "Missing refresh token" });

//   try {
//     const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

//     const user = await User.findById(decoded.id);
//     if (!user || user.refreshToken !== refreshToken) {
//       return res.status(401).json({ msg: "Invalid refresh token" });
//     }

//     const newAccessToken = jwt.sign(
//       { id: user.id },
//       process.env.JWT_ACCESS_SECRET,
//       { expiresIn: "15m" }
//     );

//     return res.json({ accessToken: newAccessToken });
//   } catch (err) {
//     return res.status(401).json({ msg: "Invalid refresh token" });
//   }
// });
// router.post("/logout", auth, async (req, res) => {
//   try {
//     await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
//     return res.json({ msg: "Logged out" });
//   } catch (err) {
//     return res.status(500).json({ msg: "Server error" });
//   }
// });

// module.exports = router;


const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const auth = require("../../middleware/auth");
const User = require("../../model/User_model");

/**
 * POST /api/auth
 * Login:
 * - בודק מייל+סיסמה
 * - יוצר access token קצר ו-refresh token ארוך
 * - שומר refresh token ב-DB כדי לאמת אותו בעתיד
 */
router.post("/", async (req, res) => {
  const { email, password } = req.body;

  // ולידציה בסיסית
  if (!email || !password) {
    return res.status(400).json({ msg: "Please fill in required details" });
  }

  try {
    // נרמול מייל כדי למנוע בעיות אותיות גדולות/רווחים
    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ msg: "Invalid credentials" });

    // השוואת סיסמה מול ה-hash (באמצעות הפונקציה במודל)
    const isMatched = await user.comparePassword(password);
    if (!isMatched) return res.status(401).json({ msg: "Invalid credentials" });

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

    // שומרים refresh token למשתמש ב-DB (כדי שנוכל לאמת בעתיד)
    user.refreshToken = refreshToken;
    await user.save();

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

/**
 * GET /api/auth/user
 * מחזיר את המשתמש המחובר (בלי סיסמה)
 */
router.get("/user", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    return res.json(user);
  } catch (err) {
    return res.status(500).json({ msg: "Server error" });
  }
});

/**
 * POST /api/auth/refresh
 * מקבל refreshToken ומחזיר accessToken חדש
 */
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ msg: "Missing refresh token" });
  }

  try {
    // אימות שה-refreshToken חתום וסוגר תוקף
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // מאמתים גם מול ה-DB (כדי שלא כל refresh token "תקף" יעבוד)
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ msg: "Invalid refresh token" });
    }

    const newAccessToken = jwt.sign(
      { id: user.id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    return res.json({ accessToken: newAccessToken });
  } catch (err) {
    return res.status(401).json({ msg: "Invalid refresh token" });
  }
});

/**
 * POST /api/auth/logout
 * מנקה refreshToken ב-DB -> למעשה מנתק את המשתמש
 */
router.post("/logout", auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    return res.json({ msg: "Logged out" });
  } catch (err) {
    return res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
