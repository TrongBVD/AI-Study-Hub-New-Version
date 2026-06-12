function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "SYSTEM_ADMIN") {
        return res.status(403).json({
            status: "error",
            message: "Admin acces required.",
        });
    }

    next();
}

module.exports = requireAdmin;