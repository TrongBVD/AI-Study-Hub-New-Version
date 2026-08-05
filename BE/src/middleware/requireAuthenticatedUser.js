function requireAuthenticatedUser(req, res, next) {
  if (String(req.user?.role || "").toUpperCase() === "GUEST") {
    return res.status(403).json({
      status: "error",
      message: "Log in to use AI features.",
    });
  }

  return next();
}

module.exports = requireAuthenticatedUser;
