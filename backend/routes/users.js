const router = require("express").Router();
const pool = require("../db/pool");
const { protect, adminOnly } = require("../middleware/auth");

const likeEscape = (s) => s.replace(/[\\%_]/g, "\\$&");

// GET /api/users (admin) - customers with their order totals
router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
    const q = String(req.query.q || "").trim();
    const params = [];
    const where = ["u.role = 'customer'"];
    if (q) {
      params.push(`%${likeEscape(q)}%`);
      where.push(`(u.name ILIKE $1 OR u.email ILIKE $1 OR u.phone ILIKE $1)`);
    }
    const clause = where.join(" AND ");
    const total = Number((await pool.query(`SELECT count(*) FROM users u WHERE ${clause}`, params)).rows[0].count);
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.created_at,
              COUNT(o.id) FILTER (WHERE o.status <> 'cancelled')::int AS orders_count,
              COALESCE(SUM(o.total) FILTER (WHERE o.status <> 'cancelled'), 0) AS total_spent,
              MAX(o.created_at) AS last_order_at
       FROM users u LEFT JOIN orders o ON o.user_id = u.id
       WHERE ${clause}
       GROUP BY u.id ORDER BY u.created_at DESC
       LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params);
    res.json({
      customers: rows.map((r) => ({
        _id: r.id, name: r.name, email: r.email, phone: r.phone || "", createdAt: r.created_at,
        ordersCount: r.orders_count, totalSpent: Number(r.total_spent), lastOrderAt: r.last_order_at,
      })),
      total, page, pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load customers" });
  }
});

module.exports = router;
