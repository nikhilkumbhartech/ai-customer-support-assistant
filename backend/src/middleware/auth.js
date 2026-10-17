const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token =
    req.cookies?.token || (header?.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) return res.status(401).json({ message: 'Not authenticated' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); 
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

const requireAdmin = (req, res, next) =>
  req.user?.role === 'admin'
    ? next()
    : res.status(403).json({ message: 'Admin only' });

module.exports = { requireAuth, requireAdmin };