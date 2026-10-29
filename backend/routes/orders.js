const router = require("express").Router();
const pool = require("../db/pool");
const { protect, adminOnly } = require("../middleware/auth");
const { validateOrderInput, calcTotals } = require("../lib/orderRules");
const { toOrder, toItem } = require("../lib/serialize");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "cancelled"];
const PAY_STATUSES = ["unpaid", "paid", "refunded"];

async function attachItems(rows, user) {
  if (!rows.length) return [];
  const { rows: items } = await pool.query(
    "SELECT * FROM order_items WHERE order_id = ANY($1::uuid[])", [rows.map((r) => r.id)]);
  return rows.map((r) => toOrder(r, items.filter((i) => i.order_id === r.id).map(toItem)));
}

// POST /api/orders - place a cash-on-delivery order
router.post("/", protect, async (req, res) => {
  const { items, shippingAddress, deliveryZone, pickupLocation } = req.body;
  const paymentMethod = req.body.paymentMethod || "cod";
  const problem = validateOrderInput({ items, shippingAddress, deliveryZone, pickupLocation, paymentMethod });
  if (problem) return res.status(400).json({ message: problem });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lines = [];
    for (const item of items) {
      if (!UUID_RE.test(item.productId)) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Product not found" }); }
      // Atomic stock check + decrement: no overselling under concurrent orders
      const { rows } = await client.query(
        `UPDATE products SET stock = stock - $2, sold_count = sold_count + $2, updated_at = now()
         WHERE id = $1 AND active = true AND stock >= $2 RETURNING *`,
        [item.productId, item.quantity]);
      if (!rows[0]) {
        await client.query("ROLLBACK");
        const p = (await pool.query("SELECT name FROM products WHERE id = $1 AND active = true", [item.productId])).rows[0];
        return res.status(p ? 400 : 404).json({ message: p ? `Insufficient stock for ${p.name}` : "Product not found" });
      }
      lines.push({ product: rows[0], quantity: item.quantity, size: item.size || "", color: item.color || "",
                   price: Number(rows[0].price) });
    }

    const { subtotal, shippingFee, total } = calcTotals(lines, deliveryZone);
    const order = (await client.query(
      `INSERT INTO orders (user_id, shipping_address, delivery_zone, pickup_location, subtotal, shipping_fee, total, payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user._id, JSON.stringify(shippingAddress), deliveryZone,
       deliveryZone === "nairobi-pickup" ? pickupLocation : "", subtotal, shippingFee, total, paymentMethod]
    )).rows[0];

    for (const l of lines) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, name, price, quantity, size, color, image)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [order.id, l.product.id, l.product.name, l.price, l.quantity, l.size, l.color, l.product.images[0] || ""]);
    }
    await client.query("COMMIT");
    res.status(201).json({ order: (await attachItems([order]))[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({ message: "Could not place order" });
  } finally {
    client.release();
  }
});

// GET /api/orders/my
router.get("/my", protect, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC", [req.user._id]);
    res.json({ orders: await attachItems(rows) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load orders" });
  }
});

// GET /api/orders/stats/summary (admin)  - must be before "/:id" style routes
router.get("/stats/summary", protect, adminOnly, async (req, res) => {
  try {
    const [rev, count, top] = await Promise.all([
      pool.query("SELECT COALESCE(SUM(total),0) AS total FROM orders WHERE payment_status = 'paid'"),
      pool.query("SELECT count(*) FROM orders"),
      pool.query(
        `SELECT product_id AS _id, MIN(name) AS name, SUM(quantity)::int AS units,
                SUM(price * quantity) AS revenue
         FROM order_items GROUP BY product_id ORDER BY units DESC LIMIT 5`),
    ]);
    res.json({
      revenue: Number(rev.rows[0].total),
      ordersCount: Number(count.rows[0].count),
      topProducts: top.rows.map((r) => ({ ...r, revenue: Number(r.revenue) })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load stats" });
  }
});

// GET /api/orders (admin)  - optional ?status= and ?q= (order id, customer name/email/phone, product name)
router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const { status } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const params = [];
    const conds = [];
    if (status) { params.push(status); conds.push(`o.status = $${params.length}`); }
    const q = String(req.query.q || "").trim().replace(/^#/, "");
    if (q) {
      params.push(`%${q.replace(/[\\%_]/g, "\\$&")}%`);
      const i = params.length;
      conds.push(`(o.id::text ILIKE $${i} OR u.name ILIKE $${i} OR u.email ILIKE $${i}
        OR o.shipping_address->>'name' ILIKE $${i} OR o.shipping_address->>'phone' ILIKE $${i}
        OR EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.name ILIKE $${i}))`);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const total = Number((await pool.query(
      `SELECT count(*) FROM orders o LEFT JOIN users u ON u.id = o.user_id ${where}`, params)).rows[0].count);
    const { rows } = await pool.query(
      `SELECT o.*, u.name AS user_name, u.email AS user_email
       FROM orders o LEFT JOIN users u ON u.id = o.user_id ${where}
       ORDER BY o.created_at DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params);
    res.json({ orders: await attachItems(rows), total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load orders" });
  }
});

// PATCH /api/orders/:id (admin) - status, tracking, and cash-collected flag
router.patch("/:id", protect, adminOnly, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ message: "Order not found" });
    const { status, trackingNumber, paymentStatus } = req.body;
    if (status && !STATUSES.includes(status)) return res.status(400).json({ message: "Invalid status" });
    if (paymentStatus && !PAY_STATUSES.includes(paymentStatus)) return res.status(400).json({ message: "Invalid payment status" });

    // Cash is collected on delivery, so a delivered order is marked paid automatically.
    const payment = paymentStatus || (status === "delivered" ? "paid" : null);
    const { rows } = await pool.query(
      `UPDATE orders SET status = COALESCE($1, status), tracking_number = COALESCE($2, tracking_number),
         payment_status = COALESCE($3, payment_status), updated_at = now()
       WHERE id = $4 RETURNING *`,
      [status || null, trackingNumber || null, payment, req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: "Order not found" });
    res.json({ order: (await attachItems(rows))[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not update order" });
  }
});

module.exports = router;
