const router = require('express').Router();
const pool = require('../config/db');
const { register, login } = require('../service/authService');
const { requireAuth } = require('../middleware/auth');

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 24 * 60 * 60 * 1000, // 1 din
};

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 6)
      return res.status(400).json({ message: 'name, email and password (min 6) required' });
    const user = await register({ name, email, password });
    res.status(201).json({ user });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'email and password required' });
    const { user, token } = await login({ email, password });
    res.cookie('token', token, cookieOptions).json({ user, token });
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) { next(err); }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', cookieOptions).json({ message: 'Logged out' });
});

module.exports = router;