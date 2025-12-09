//config/db.js
const mongoose = require('mongoose');

async function connectDB() {
  try {
    const mongoURI = process.env.MONGO_URI;   // נקרא מתוך .env

    await mongoose.connect(mongoURI);

    console.log('✅ Connected to MongoDB Atlas (planetCraftersDB)');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1); // לעצור את השרת אם אין חיבור DB
  }
}

module.exports = connectDB;