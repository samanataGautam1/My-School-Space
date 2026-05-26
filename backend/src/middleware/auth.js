const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "devsecret";

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1]; // Bearer <token>

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const allowRoles = (...roles) => {
  return (req, res, next) => {
    const allowedRoles = roles.map((r) => r.toUpperCase());
    const userRole = req.user?.role?.toUpperCase();

    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    if (!allowedRoles.includes(userRole)) {
      return res
        .status(403)
        .json({ error: "Access denied", userRole, allowedRoles });
    }

    next();
  };
};

module.exports = {
  authMiddleware,
  allowRoles,
};
