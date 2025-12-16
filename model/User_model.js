// const mongoose = require("mongoose");

// const Schema = mongoose.Schema;

// const UserSchema = new Schema({
//   name: {
//     type: String,
//     required: true,
//   },
//   email: {
//     type: String,
//     required: true,
//   },
//   password: {
//     type: String,
//     required: true,
//   },
//   refreshToken: { 
//     type: String,
//     default: null,
//   },
//   register_date: {
//     type: Date,
//     default: Date.now,
//   },
// });

// module.exports = User = mongoose.model("user", UserSchema);


// model/User_model.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * User:
 * כולל hashing לסיסמה לפני שמירה (חובה).
 * כולל פונקציה להשוואת סיסמה בזמן Login.
 */
const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true, // שלא יהיו שני משתמשים עם אותו מייל
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      // כאן יישמר ה-hash, לא הסיסמה המקורית
    },

    refreshToken: {
      type: String,
      default: null,
    },

    register_date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

/**
 * לפני שמירת משתמש:
 * אם הסיסמה שונתה/נוצרה -> עושים לה hash.
 * אם לא שונתה -> לא נוגעים (כדי לא לעשות hash כפול).
 */
UserSchema.pre("save", async function () {
  // אם לא שינו password, לא עושים hashing מחדש
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * השוואת סיסמה בזמן Login:
 * מחזיר true/false
 */
UserSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.model("user", UserSchema);
