const { Pool } = require("pg");

const ssl =
  process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/stylehub",
  ssl,
});

pool.on("error", (err) => console.error("Unexpected PostgreSQL error:", err.message));

module.exports = pool;
