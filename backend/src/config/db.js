require("dotenv").config();
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Create backend/.env first.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on("error", (err) => {
  console.error("Unexpected database error:", err.message);
});

const query = (text, params) => pool.query(text, params);
const connect = () => pool.connect();

module.exports = { pool, query, connect };