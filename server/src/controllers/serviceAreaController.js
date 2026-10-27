const serviceArea = require('../config/serviceArea');

// GET /api/service-area — the client draws this circle on the map
function getServiceArea(_req, res) {
  res.json(serviceArea);
}

// POST /api/service-area/check   Body: { address }
// requireServiceArea runs first; if we get here the address is inside.
function checkAddress(req, res) {
  res.json({ inside: true, distanceKm: req.geo.distanceKm, location: { lat: req.geo.lat, lng: req.geo.lng } });
}

module.exports = { getServiceArea, checkAddress };
