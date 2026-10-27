const User = require('../models/User');
const AppError = require('../utils/AppError');
const { setAuthCookie, clearAuthCookie } = require('../utils/generateToken');
const { toGeoJSONPoint, checkServiceArea } = require('../services/geoService');

// POST /api/auth/register   (requireServiceArea has already geocoded and approved req.body.address)
async function register(req, res) {
  const { name, email, password, address } = req.body;
  const user = await User.create({
    name,
    email,
    password,
    address: { ...address, location: toGeoJSONPoint(req.geo) },
  });
  setAuthCookie(res, user);
  res.status(201).json({ user, distanceKm: req.geo.distanceKm });
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password, coords } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }

  // Optional soft geofence on login itself (customers only). Browser GPS can be spoofed,
  // so the real enforcement is on the delivery address at registration and checkout.
  if (process.env.STRICT_LOGIN_GEOFENCE === 'true' && user.role === 'customer') {
    if (!coords) throw new AppError('Please allow location access to log in', 403, { code: 'LOCATION_REQUIRED' });
    const check = checkServiceArea(coords);
    if (!check.inside) {
      throw new AppError(`Login is only available within ${check.radiusKm} km of Toronto`, 403, {
        code: 'OUT_OF_SERVICE_AREA',
        distanceKm: check.distanceKm,
        radiusKm: check.radiusKm,
      });
    }
  }

  setAuthCookie(res, user);
  res.json({ user });
}

// POST /api/auth/logout
function logout(_req, res) {
  clearAuthCookie(res);
  res.json({ message: 'Logged out' });
}

// GET /api/auth/me
function me(req, res) {
  res.json({ user: req.user });
}

// PUT /api/auth/me/address   (re-checked against the service area)
async function updateAddress(req, res) {
  req.user.address = { ...req.body.address, location: toGeoJSONPoint(req.geo) };
  await req.user.save();
  res.json({ user: req.user, distanceKm: req.geo.distanceKm });
}

module.exports = { register, login, logout, me, updateAddress };
