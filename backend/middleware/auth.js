const jwt = require("jsonwebtoken");
const pool = require("../db/pool");
const { toUser } = require("../lib/serialize");

exports.protect = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer "))
    return res.status(401).json({ message: "Not authenticated" });

  try {
    const decoded = jwt.verify(auth.split(" ")[1], process.env.JWT_SECRET);
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [decoded.id]);
    if (!rows[0]) return res.status(401).json({ message: "User not found" });
    const changedAt = rows[0].password_changed_at;
    if (changedAt && decoded.iat < Math.floor(new Date(changedAt).getTime() / 1000))
      return res.status(401).json({ message: "Password was changed. Please sign in again." });
    req.user = toUser(rows[0]);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

exports.adminOnly = (req, res, next) => {
  if (req.user?.role !== "admin")
    return res.status(403).json({ message: "Admin access required" });
  next();
};
