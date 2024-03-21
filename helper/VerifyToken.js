const jwt = require('jsonwebtoken')
require('dotenv').config();

const VerifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Extract the token from the Authorization header
    jwt.verify(token,process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.log("Authentication error:", err.message);
        return res.status(401).json({ message: "Unauthorized: Invalid token" });
      }
      req.user = decoded; // Attach the decoded user information to the request object
      console.log("User verified")
      next();
    });
  } else {
    console.log("Authentication error: Token missing");
    res.status(401).json({ message: "Unauthorized: Token missing" });
  };
};

module.exports = VerifyToken;