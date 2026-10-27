const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { COOKIE_NAME } = require('../utils/generateToken');

function readToken(req) {
  if (req.cookies?.[COOKIE_NAME]) return req.cookies[COOKIE_NAME];
  const header = req.headers.authorization || '';
  // Bearer tokens are accepted too, handy for Postman/curl or a future mobile app.
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function userFromToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError('Session expired or invalid, please log in again', 401);
  }
  const user = await User.findById(payload.id);
  if (!user) throw new AppError('Account no longer exists', 401);
  return user;
}

/** Requires a logged-in user; sets req.user. */
async function protect(req, _res, next) {
  const token = readToken(req);
  if (!token) throw new AppError('Please log in', 401);
  req.user = await userFromToken(token);
  next();
}

/** Usage: router.post('/', protect, authorize('admin'), handler) */
function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to do that', 403));
    }
    next();
  };
}

module.exports = { protect, authorize, userFromToken, readToken };
