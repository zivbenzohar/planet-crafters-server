// model/User_model.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    userName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true, 
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    refreshToken: {
      type: String,
      default: null,
    },

    activePlanetId: {
      type: String, // למשל "planet_01"
      default: null,
      index: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
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
