const mongoose = require("mongoose");

const AchievementSchema = new mongoose.Schema(
  {
    achievementId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    category: {
      type: String,
      required: true,
      enum: ["Single", "Multi"],
      index: true,
    },

    targetValue: {
      type: Number,
      required: true,
      min: 1,
    },

    rewardType: {
      type: String,
      required: true,
      trim: true,
    },

    rewardAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    metricKey: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    progressMode: {
      type: String,
      enum: ["inc", "max", "unique"],
      default: "inc",
    },

    trigger: {
      type: String,
      default: "",
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

AchievementSchema.index({ category: 1, metricKey: 1 });

module.exports = mongoose.model("Achievement", AchievementSchema);
