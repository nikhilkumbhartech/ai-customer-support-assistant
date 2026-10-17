const rateLimit = require('express-rate-limit');

// ek user: 1 minute mein max 15 sawal
exports.chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  keyGenerator: (req) => `user-${req.user.id}`, // IP nahi, user id se gino
  message: { error: 'Bahut zyada sawal, 1 minute baad try karo' },
  standardHeaders: true,
  legacyHeaders: false,
});