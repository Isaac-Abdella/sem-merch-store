const { rateLimit } = require('express-rate-limit');

const skip = () => process.env.NODE_ENV === 'test';

// Slows down password guessing on login/register.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
  message: { message: 'Too many attempts, please try again in a few minutes' },
});

// General API protection.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
});

// Drivers post GPS every few seconds; allow more but still cap it.
const trackingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
});

module.exports = { authLimiter, apiLimiter, trackingLimiter };
