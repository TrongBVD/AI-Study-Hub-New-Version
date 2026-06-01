const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Beaerer")) {
      return res.status(401).json({
        status: "error",
        message: "Missing or invalid Authorization header",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userID =
      decoded.userID || decoded.id || decoded.user_id || decoded.sub;

    if (!userID) {
      return res.status(401).json({
        status: "error",
        message: "Token does not contain user id",
      });
    }
    req.user = {
      id: String(userID),
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (error) {
    return res.status(401).json({
      status: "error",
      message: "Unauthorized",
      error: error.message,
    });
  }
}

module.exports = authMiddleware;
