const jwt = require("jsonwebtoken");

module.exports = function auth(req, res, next) {
  const header = req.header("Authorization"); // "Bearer <token>"
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ msg: "Authorization denied, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = decoded; // { id: ... }
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Token not valid" });
  }
};
