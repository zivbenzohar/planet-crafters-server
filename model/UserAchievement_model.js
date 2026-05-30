const mongoose = require("mongoose");

const UserAchievementSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    achievementId: {
      type: String,
      required: true,
      index: true,
    },

    progress: {
      type: Number,
      default: 0,
      min: 0,
    },

    uniqueValues: {
      type: [String],
      default: [],
    },

    completed: {
      type: Boolean,
      default: false,
      index: true,
    },

    completedAt: {
      type: Date,
      default: null,
    },

    rewardGranted: {
      type: Boolean,
      default: false,
    },

    rewardGrantedAt: {
      type: Date,
      default: null,
    },

    rewardType: {
      type: String,
      default: "",
    },

    rewardAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

UserAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });

module.exports = mongoose.model("UserAchievement", UserAchievementSchema);
