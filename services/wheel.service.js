const User = require("../model/User_model");

const ACCRUAL_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const SPINS_PER_INTERVAL = 2;
const MAX_CREDITS = 10;

// Adds pending spin credits based on elapsed time. Returns updated user.
async function accrueSpins(userId) {
  const user = await User.findById(userId).select("spinCredits lastSpinAccrual");
  if (!user) throw new Error("User not found");

  const now = new Date();
  const last = user.lastSpinAccrual ?? now;
  const elapsed = now - last;
  const periods = Math.floor(elapsed / ACCRUAL_INTERVAL_MS);

  if (periods > 0) {
    const toAdd = periods * SPINS_PER_INTERVAL;
    const newCredits = Math.min(user.spinCredits + toAdd, MAX_CREDITS);
    const newAccrual = new Date(last.getTime() + periods * ACCRUAL_INTERVAL_MS);

    await User.updateOne(
      { _id: userId },
      { spinCredits: newCredits, lastSpinAccrual: newAccrual }
    );

    user.spinCredits = newCredits;
    user.lastSpinAccrual = newAccrual;
  } else if (!user.lastSpinAccrual) {
    await User.updateOne({ _id: userId }, { lastSpinAccrual: now });
    user.lastSpinAccrual = now;
  }

  return user;
}

function secondsUntilNextAccrual(lastSpinAccrual) {
  if (!lastSpinAccrual) return 0;
  const next = new Date(lastSpinAccrual.getTime() + ACCRUAL_INTERVAL_MS);
  const remaining = next - new Date();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

async function getWheelStatus(userId) {
  const user = await accrueSpins(userId);

  return {
    success: true,
    canSpin: user.spinCredits > 0,
    spinCredits: user.spinCredits,
    remainingSeconds: secondsUntilNextAccrual(user.lastSpinAccrual),
    nextSpinAt: user.lastSpinAccrual
      ? new Date(user.lastSpinAccrual.getTime() + ACCRUAL_INTERVAL_MS).toISOString()
      : null,
  };
}

async function consumeSpin(userId) {
  const user = await accrueSpins(userId);

  if (user.spinCredits <= 0) {
    return {
      success: false,
      canSpin: false,
      spinCredits: 0,
      remainingSeconds: secondsUntilNextAccrual(user.lastSpinAccrual),
      nextSpinAt: user.lastSpinAccrual
        ? new Date(user.lastSpinAccrual.getTime() + ACCRUAL_INTERVAL_MS).toISOString()
        : null,
      msg: "No spin credits available",
    };
  }

  const newCredits = user.spinCredits - 1;
  await User.updateOne({ _id: userId }, { $set: { spinCredits: newCredits, lastWheelSpin: new Date() } });

  return {
    success: true,
    canSpin: newCredits > 0,
    spinCredits: newCredits,
    remainingSeconds: secondsUntilNextAccrual(user.lastSpinAccrual),
    nextSpinAt: user.lastSpinAccrual
      ? new Date(user.lastSpinAccrual.getTime() + ACCRUAL_INTERVAL_MS).toISOString()
      : null,
  };
}

async function grantSpin(userId, amount = 1) {
  const user = await accrueSpins(userId);
  const newCredits = Math.min(user.spinCredits + amount, MAX_CREDITS);
  await User.updateOne({ _id: userId }, { spinCredits: newCredits });
  return { success: true, spinCredits: newCredits };
}

module.exports = { getWheelStatus, consumeSpin, grantSpin };
