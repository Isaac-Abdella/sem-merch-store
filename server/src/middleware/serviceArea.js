/**
 * Geofence: only allow addresses within the service radius (default 25 km of Toronto).
 *
 * The address is geocoded HERE, on the server. Never trust lat/lng sent by the browser for this
 * decision — anyone can edit a request. On success, sets:
 *   req.geo = { lat, lng, label, provider, distanceKm }
 */
const { geocode } = require('../services/geocodeService');
const { checkServiceArea } = require('../services/geoService');
const AppError = require('../utils/AppError');

function requireServiceArea(getAddress = (req) => req.body.address) {
  return async (req, _res, next) => {
    const address = getAddress(req);
    if (!address) throw new AppError('An address is required', 400);

    const point = await geocode(address);
    if (!point) {
      throw new AppError("We couldn't find that address. Please check it and try again.", 400, {
        code: 'ADDRESS_NOT_FOUND',
      });
    }

    const result = checkServiceArea(point);
    if (!result.inside) {
      throw new AppError(
        `Sorry, we only deliver within ${Math.round(result.radiusKm)} km of Toronto. ` +
          `That address is about ${Math.round(result.distanceKm)} km away.`,
        403,
        { code: 'OUT_OF_SERVICE_AREA', distanceKm: result.distanceKm, radiusKm: result.radiusKm }
      );
    }

    req.geo = { ...point, distanceKm: result.distanceKm };
    next();
  };
}

module.exports = { requireServiceArea };
