// seedUsers.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./model/User_model');

async function run() {
  try {
    const mongoURI = process.env.MONGO_URI;
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB Atlas (for seeding users)');

    // מוחקים משתמשים קודמים אם יש (לא חובה, אבל נוח לפיתוח)
    await User.deleteMany({});
    console.log('🧹 Cleared users collection');

    // מוסיפים כמה משתמשים קלאסיים
    const users = await User.insertMany([
      {
        name: 'Test User 1',
        email: 'test1@example.com',
        password: '1234'
      },
      {
        name: 'Test User 2',
        email: 'test2@example.com',
        password: 'abcd'
      },
      {
        name: 'Reut Player',
        email: 'reut@example.com',
        password: 'secret'
      }
    ]);

    console.log('✅ Inserted users:');
    console.log(users);

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exit(1);
  }
}

run();