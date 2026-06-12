const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Missing or invalid Authorization header",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userID =
      decoded.userId ||
      decoded.userID ||
      decoded.id ||
      decoded.user_id ||
      decoded.sub;

    if (!userID) {
      return res.status(401).json({
        status: "error",
        message: "Token does not contain user id",
      });
    }

    const { data: user, error} = await supabase
      .from("profiles")
      .select("id, email, username, full_name, role, status")
      .eq("id", userID)
      .maybeSingle();
    
    if (error){
      throw error;
    }

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "User account no longer exists",
      });
    }

    if (user.status === "DISABLED"){
      return res.status(403).json({
        status: "error",
        message: "Your account has been disabled.",
      });
    }

    req.user = {
      id: String(user.id),
      email: user.email,
      username: user.username,
      full_name: user.full_name,
      role: user.role || "USER",
      status: user.status || "ACTIVE",
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