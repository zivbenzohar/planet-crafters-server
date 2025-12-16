const HexTileTemplate = require("../model/HexTile_model"); // אצלך זה HexTile_model.js

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * ייצור ערימה ראשונית לשלב (POC):
 * בוחר רנדומלית מתוך templates קיימים ב-DB.
 * בהמשך: תחליפו לרולס לפי stage.
 */
module.exports = async function buildStackForStage(stage, size = 30) {
  const templates = await HexTileTemplate.find({}, { _id: 1 }).lean();
  if (!templates.length) throw new Error("אין hexTileTemplate ב-DB (צריך seed)");

  const stack = [];
  for (let i = 0; i < size; i++) {
    const t = pickRandom(templates);
    stack.push({ templateId: t._id });
  }
  return stack;
};
