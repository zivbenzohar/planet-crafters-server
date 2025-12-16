require("dotenv").config();
const mongoose = require("mongoose");

const User = require("../model/User_model");

/**
 * כאן מכניסים משתמשים חדשים.
 * חשוב: אנחנו שמים password כ-plaintext פה בכוונה,
 * כי במודל User יש pre('save') שעושה hashing אוטומטי.
 */
const users = [
  { name: "Test One", email: "test1@mail.com", password: "123456" },
  { name: "Test Two", email: "test2@mail.com", password: "123456" },
];

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error("Missing MONGO_URI in .env");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB");

  // מוחקים משתמשים ישנים כדי להתחיל נקי
  const del = await User.deleteMany({});
  console.log(`🧹 Deleted users: ${del.deletedCount}`);

  // יוצרים אחד-אחד כדי שה-pre('save') יעשה hashing
  for (const u of users) {
    const user = new User({
      name: u.name.trim(),
      email: u.email.trim().toLowerCase(),
      password: u.password, // ייהפך ל-hash בעת save
    });
    await user.save();
  }

  console.log(`✅ Inserted users: ${users.length}`);

  await mongoose.disconnect();
  console.log("✅ Disconnected");
}

main().catch((e) => {
  console.error("❌ seedUsers failed:", e);
  process.exit(1);
});
