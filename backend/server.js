require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const pool = require("./db/pool");
const { isCloudinaryConfigured } = require("./lib/imageStore");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be set to a random string of at least 32 characters.");
  process.exit(1);
}

const app = express();
// CORS: allow localhost / local-network addresses (development) plus anything in CLIENT_URL
// (comma-separated, e.g. your deployed frontend URL).
const extraOrigins = (process.env.CLIENT_URL || "").split(",").map((s) => s.trim()).filter(Boolean);
const localDev =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || localDev.test(origin) || extraOrigins.includes(origin)),
}));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/users", require("./routes/users"));

app.get("/api/health", async (req, res) => {
  try { await pool.query("SELECT 1"); res.json({ status: "ok", database: "up" }); }
  catch { res.status(503).json({ status: "degraded", database: "down" }); }
});

// Upload / multer errors -> clean JSON
app.use((err, req, res, next) => {
  if (err) return res.status(400).json({ message: err.message || "Bad request" });
  next();
});

const PORT = process.env.PORT || 5000;
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ PostgreSQL connected");
    // Free hosts (e.g. Render) have no shell: set AUTO_MIGRATE=true to create/upgrade tables on every start.
    if (process.env.AUTO_MIGRATE === "true") {
      await pool.query(fs.readFileSync(path.join(__dirname, "db/schema.sql"), "utf8"));
      console.log("✅ Database schema is up to date");
    }
    if (isCloudinaryConfigured()) console.log("🖼  Product images: Cloudinary");
    else console.warn("⚠️  Product images: local disk (CLOUDINARY_* not set). On free hosting these are lost on restart.");
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("PostgreSQL connection failed:", err.message);
    process.exit(1);
  }
})();
