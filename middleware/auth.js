const jwt = require("jsonwebtoken");

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) return res.status(401).json({ msg: "Missing token" });
  console.log("DEBUG token:", token);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = { id: payload.id };
    return next();
  } catch (e) {
    console.log("VERIFY ERROR:", e.name, e.message);
    return res.status(401).json({ msg: "Invalid token" });
  }
};
