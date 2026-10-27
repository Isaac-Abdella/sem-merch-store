const serviceArea = require('../config/serviceArea');

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle (haversine) distance between two {lat, lng} points, in km. */
function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

function checkServiceArea(point, area = serviceArea) {
  const d = distanceKm(area.center, point);
  return {
    inside: d <= area.radiusKm,
    distanceKm: Math.round(d * 10) / 10,
    radiusKm: Math.round(area.radiusKm * 10) / 10,
  };
}

const toGeoJSONPoint = ({ lat, lng }) => ({ type: 'Point', coordinates: [lng, lat] });

const fromGeoJSONPoint = (p) =>
  p && Array.isArray(p.coordinates) ? { lat: p.coordinates[1], lng: p.coordinates[0] } : null;

/**
 * MongoDB query for documents whose GeoJSON field is inside the service area.
 * Example: User.find(withinServiceArea('address.location'))
 */
function withinServiceArea(field, area = serviceArea) {
  return {
    [field]: {
      $geoWithin: { $centerSphere: [[area.center.lng, area.center.lat], area.radiusKm / EARTH_RADIUS_KM] },
    },
  };
}

module.exports = { distanceKm, checkServiceArea, toGeoJSONPoint, fromGeoJSONPoint, withinServiceArea };
