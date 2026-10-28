// Usage: set ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD in .env then run: npm run seed-admin
require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("./db/pool");

(async () => {
  try {
    const name = process.env.ADMIN_NAME || "Store Owner";
    const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "";
    if (!email.includes("@")) throw new Error("Set ADMIN_EMAIL in .env");
    if (password.length < 12 || password.startsWith("replace_with"))
      throw new Error("Set ADMIN_PASSWORD in .env (at least 12 characters)");

    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      `INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,'admin')
       ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, role = 'admin', updated_at = now()`,
      [name, email, hash]);
    console.log(`✅ Admin ready: ${email}`);
  } catch (err) {
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
