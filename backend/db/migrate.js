require("dotenv").config();
const fs = require("fs");
const path = require("path");
const pool = require("./pool");

(async () => {
  try {
    await pool.query(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
    console.log("✅ Database schema is up to date");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
