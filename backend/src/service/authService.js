const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

const httpError = (status, message) => {
  const e = new Error(message);
  e.status = status;
  return e;
};

async function register({ name, email, password }) {
  email = email.toLowerCase().trim();
  const exists = await pool.query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (exists.rowCount) throw httpError(409, 'Email already registered');

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, role, created_at`,
    [name.trim(), email, hash]
  );
  return rows[0];
}

async function login({ email, password }) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [
    email.toLowerCase().trim(),
  ]);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw httpError(401, 'Invalid email or password');

  const { password_hash, ...safeUser } = user;
  return { user: safeUser, token: signToken(user) };
}

module.exports = { register, login };