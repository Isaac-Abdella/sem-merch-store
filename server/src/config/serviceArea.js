// Single source of truth for the delivery area.
// Everything (registration, checkout, the client map) reads from here.
const KM_TO_MILES = 0.621371;

const radiusKm = Number(process.env.SERVICE_RADIUS_KM || 25);

module.exports = {
  name: 'Greater Toronto Area',
  center: {
    lat: Number(process.env.SERVICE_CENTER_LAT || 43.6534), // Toronto City Hall
    lng: Number(process.env.SERVICE_CENTER_LNG || -79.3841),
  },
  radiusKm,
  radiusMiles: Math.round(radiusKm * KM_TO_MILES * 10) / 10, // ≈ 15.5 miles for 25 km
};
