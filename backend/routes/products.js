const router = require("express").Router();
const multer = require("multer");
const pool = require("../db/pool");
const { protect, adminOnly } = require("../middleware/auth");
const { toProduct } = require("../lib/serialize");

const CATEGORIES = ["Tops", "Bottoms", "Dresses", "Outerwear", "Accessories"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const { saveImages } = require("../lib/imageStore");

// Files are kept in memory, then saved by lib/imageStore (Cloudinary, or local disk when not configured).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Images only")),
});

// Form fields arrive as strings (multipart); accept CSV, JSON array, or repeated fields.
function toList(v) {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  const s = String(v).trim();
  if (!s) return [];
  if (s.startsWith("[")) { try { return JSON.parse(s).map(String); } catch { /* fall through */ } }
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
const toBool = (v) => (v === undefined ? undefined : v === true || v === "true" || v === "1");

// GET /api/products
router.get("/", async (req, res) => {
  try {
    const { category, search, featured } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const where = ["active = true"];
    const params = [];
    if (category) { params.push(category); where.push(`category = $${params.length}`); }
    if (featured) where.push("featured = true");
    if (search) {
      params.push(`%${search}%`);
      where.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length}
                   OR EXISTS (SELECT 1 FROM unnest(tags) t WHERE t ILIKE $${params.length}))`);
    }
    const clause = where.join(" AND ");
    const total = Number((await pool.query(`SELECT count(*) FROM products WHERE ${clause}`, params)).rows[0].count);
    const { rows } = await pool.query(
      `SELECT * FROM products WHERE ${clause} ORDER BY created_at DESC
       LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params);
    res.json({ products: rows.map(toProduct), total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load products" });
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ message: "Product not found" });
    const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ message: "Product not found" });
    res.json({ product: toProduct(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load product" });
  }
});

// POST /api/products (admin)
router.post("/", protect, adminOnly, upload.array("images", 5), async (req, res) => {
  try {
    if (!req.files?.length) return res.status(400).json({ message: "Upload at least one product image" });
    const b = req.body;
    if (!String(b.name || "").trim()) return res.status(400).json({ message: "Product name is required" });
    if (!(Number(b.price) >= 0) || b.price === "" || b.price === undefined)
      return res.status(400).json({ message: "A valid price is required" });
    if (!CATEGORIES.includes(b.category)) return res.status(400).json({ message: "Choose a valid category" });
    let images;
    try { images = await saveImages(req.files); }
    catch (err) { return res.status(502).json({ message: err.message }); }
    const { rows } = await pool.query(
      `INSERT INTO products (name, description, price, category, images, stock, sizes, colors, tags, featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [b.name.trim(), b.description || "", Number(b.price), b.category, images,
       Math.max(0, parseInt(b.stock) || 0), toList(b.sizes) || [], toList(b.colors) || [],
       toList(b.tags) || [], toBool(b.featured) || false]
    );
    res.status(201).json({ product: toProduct(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Could not create product" });
  }
});

// PUT /api/products/:id (admin)
router.put("/:id", protect, adminOnly, upload.array("images", 5), async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ message: "Product not found" });
    const existing = (await pool.query("SELECT * FROM products WHERE id = $1", [req.params.id])).rows[0];
    if (!existing) return res.status(404).json({ message: "Product not found" });
    if (existing.images.length + (req.files || []).length > 5)
      return res.status(400).json({ message: "A product can have up to 5 images" });
    const b = req.body;
    if (b.category !== undefined && !CATEGORIES.includes(b.category))
      return res.status(400).json({ message: "Choose a valid category" });
    if (b.price !== undefined && !(Number(b.price) >= 0))
      return res.status(400).json({ message: "A valid price is required" });

    let newImages;
    try { newImages = await saveImages(req.files || []); }
    catch (err) { return res.status(502).json({ message: err.message }); }

    const { rows } = await pool.query(
      `UPDATE products SET
         name = COALESCE($1, name), description = COALESCE($2, description),
         price = COALESCE($3, price), category = COALESCE($4, category),
         stock = COALESCE($5, stock), sizes = COALESCE($6, sizes),
         colors = COALESCE($7, colors), tags = COALESCE($8, tags),
         featured = COALESCE($9, featured), active = COALESCE($10, active),
         images = images || $11::text[], updated_at = now()
       WHERE id = $12 RETURNING *`,
      [b.name?.trim() || null, b.description ?? null,
       b.price !== undefined ? Number(b.price) : null, b.category ?? null,
       b.stock !== undefined ? Math.max(0, parseInt(b.stock) || 0) : null,
       toList(b.sizes) ?? null, toList(b.colors) ?? null, toList(b.tags) ?? null,
       toBool(b.featured) ?? null, toBool(b.active) ?? null, newImages, req.params.id]
    );
    res.json({ product: toProduct(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Could not update product" });
  }
});

// DELETE /api/products/:id (admin) - soft delete
router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ message: "Product not found" });
    await pool.query("UPDATE products SET active = false, updated_at = now() WHERE id = $1", [req.params.id]);
    res.json({ message: "Product removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not remove product" });
  }
});

module.exports = router;
