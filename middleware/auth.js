const config = require("config");
const jwtToken = require("jsonwebtoken");

const auth = (req, res, next) => {
  const token = req.header("x-auth-token");

  //Check for token
  if (!token) res.status(401).json({ msg: "Authorisation denied, No token" });

  try {
    //Verify it first
    const decoded = jwtToken.verify(token, config.get("jwtSecret"));
    //Add user from payload
    req.user = decoded;
    next();
  } catch (err) {
    res.status(400).json({ msg: "Token not valid" });
  }
};

module.exports = auth;
