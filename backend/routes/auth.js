const router = require("express").Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const pool = require("../db/pool");
const { protect } = require("../middleware/auth");
const { toUser } = require("../lib/serialize");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });

const publicUser = (u) => ({ id: u._id, _id: u._id, name: u.name, email: u.email, role: u.role, phone: u.phone || "" });

// POST /api/auth/register  (always creates a customer; admins come from seed-admin.js)
router.post("/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    if (!name || !email.includes("@")) return res.status(400).json({ message: "Name and a valid email are required" });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password) VALUES ($1,$2,$3)
       ON CONFLICT (email) DO NOTHING RETURNING *`,
      [name, email, hash]
    );
    if (!rows[0]) return res.status(400).json({ message: "Email already in use" });
    const user = toUser(rows[0]);
    res.status(201).json({ token: signToken(user._id), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not create account" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    const row = rows[0];
    if (!row || !(await bcrypt.compare(String(req.body.password || ""), row.password)))
      return res.status(401).json({ message: "Invalid email or password" });
    const user = toUser(row);
    res.json({ token: signToken(user._id), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login failed" });
  }
});

// GET /api/auth/me
router.get("/me", protect, (req, res) => res.json({ user: req.user }));

// PATCH /api/auth/me  - update your details (name, email, phone)
router.patch("/me", protect, async (req, res) => {
  try {
    const name = req.body.name === undefined ? null : String(req.body.name).trim();
    const email = req.body.email === undefined ? null : String(req.body.email).trim().toLowerCase();
    const phone = req.body.phone === undefined ? null : String(req.body.phone).trim();
    if (name !== null && !name) return res.status(400).json({ message: "Name can't be empty" });
    if (email !== null && !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ message: "Enter a valid email address" });
    if (phone !== null && phone && !/^[0-9+()\s-]{7,20}$/.test(phone)) return res.status(400).json({ message: "Enter a valid phone number" });

    const { rows } = await pool.query(
      `UPDATE users SET
         name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone),
         address = COALESCE($4::jsonb, address), avatar = COALESCE($5, avatar), updated_at = now()
       WHERE id = $6 RETURNING *`,
      [name, email, phone, req.body.address ? JSON.stringify(req.body.address) : null,
       req.body.avatar ?? null, req.user._id]);
    res.json({ user: publicUser(toUser(rows[0])) });
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ message: "That email is already used by another account" });
    console.error(err);
    res.status(500).json({ message: "Could not update your details" });
  }
});

// POST /api/auth/change-password
router.post("/change-password", protect, async (req, res) => {
  try {
    const current = String(req.body.currentPassword || "");
    const next = String(req.body.newPassword || "");
    if (next.length < 6) return res.status(400).json({ message: "New password must be at least 6 characters" });
    const row = (await pool.query("SELECT password FROM users WHERE id = $1", [req.user._id])).rows[0];
    if (!(await bcrypt.compare(current, row.password)))
      return res.status(400).json({ message: "Current password is incorrect" });
    if (await bcrypt.compare(next, row.password))
      return res.status(400).json({ message: "Choose a password different from your current one" });

    const changedAt = new Date();
    await pool.query("UPDATE users SET password = $1, password_changed_at = $2, updated_at = now() WHERE id = $3",
      [await bcrypt.hash(next, 12), changedAt, req.user._id]);
    // Other devices are signed out (their tokens predate the change); this one gets a fresh token.
    res.json({ message: "Password updated", token: signToken(req.user._id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not change password" });
  }
});

// DELETE /api/auth/me  - delete your own account (needs your password)
router.delete("/me", protect, async (req, res) => {
  try {
    if (req.user.role === "admin")
      return res.status(403).json({ message: "Admin accounts can't be deleted from the app" });
    const row = (await pool.query("SELECT password FROM users WHERE id = $1", [req.user._id])).rows[0];
    if (!(await bcrypt.compare(String(req.body.password || ""), row.password)))
      return res.status(400).json({ message: "Password is incorrect" });
    // Past orders stay in the store's records (user_id becomes NULL); the personal profile is removed.
    await pool.query("DELETE FROM users WHERE id = $1", [req.user._id]);
    res.json({ message: "Account deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not delete account" });
  }
});

module.exports = router;
