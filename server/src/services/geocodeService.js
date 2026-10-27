/**
 * Turns a street address into { lat, lng }.
 *
 * GEOCODER=mock       Offline lookup by city name (GTA + a few outside cities). Use for dev and tests.
 * GEOCODER=nominatim  OpenStreetMap's free geocoder. Fine for development; its usage policy allows
 *                     max 1 request/second and requires a real User-Agent. For production traffic use a
 *                     paid geocoder (Google Geocoding, Mapbox, Geocodio) — add it as another function below.
 */
const AppError = require('../utils/AppError');

// [lat, lng] — inside/outside refers to the default 25 km radius around Toronto City Hall
const MOCK_PLACES = {
  'north york': [43.7615, -79.4111], // ~12 km — inside
  scarborough: [43.7764, -79.2318],
  etobicoke: [43.6205, -79.5132],
  toronto: [43.6534, -79.3841],
  mississauga: [43.589, -79.6441], // ~22 km — inside
  brampton: [43.7315, -79.7624], // ~32 km — OUTSIDE
  markham: [43.8561, -79.337], // ~23 km — inside
  vaughan: [43.8361, -79.4983],
  'richmond hill': [43.8828, -79.4403], // ~26 km — OUTSIDE
  oakville: [43.4675, -79.6877],
  burlington: [43.3255, -79.799],
  hamilton: [43.2557, -79.8711], // ~59 km — OUTSIDE
  pickering: [43.8384, -79.0868],
  ajax: [43.8509, -79.0204],
  oshawa: [43.8971, -78.8658], // ~50 km — OUTSIDE
  newmarket: [44.0592, -79.4613],
  guelph: [43.5448, -80.2482], // ~71 km — OUTSIDE
  'st. catharines': [43.1594, -79.2469],
  'niagara falls': [43.0896, -79.0849], // ~67 km — OUTSIDE
  barrie: [44.3894, -79.6903], // ~85 km — OUTSIDE
  kitchener: [43.4516, -80.4925], // ~92 km — OUTSIDE
  peterborough: [44.3091, -78.3197], // ~113 km — OUTSIDE
  ottawa: [45.4215, -75.6972], // OUTSIDE
};
const MOCK_KEYS = Object.keys(MOCK_PLACES).sort((a, b) => b.length - a.length);

function formatAddress(a) {
  return [a.line1, a.line2, a.city, a.province, a.postalCode, 'Canada'].filter(Boolean).join(', ');
}

async function mockGeocode(address) {
  const text = formatAddress(address).toLowerCase();
  const key = MOCK_KEYS.find((k) => text.includes(k));
  if (!key) return null;
  const [lat, lng] = MOCK_PLACES[key];
  return { lat, lng, label: key, provider: 'mock' };
}

async function nominatimGeocode(address) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', formatAddress(address));
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'ca');

  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': process.env.GEOCODER_USER_AGENT || 'merch-store-dev' },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new AppError('Address lookup is unavailable right now, please try again', 502);
  }
  if (!res.ok) throw new AppError('Address lookup failed', 502);
  const results = await res.json();
  if (!results.length) return null;
  return {
    lat: Number(results[0].lat),
    lng: Number(results[0].lon),
    label: results[0].display_name,
    provider: 'nominatim',
  };
}

const providers = { mock: mockGeocode, nominatim: nominatimGeocode };

/** @returns {Promise<{lat:number,lng:number,label:string,provider:string}|null>} null when not found */
async function geocode(address) {
  const name = process.env.GEOCODER || 'mock';
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown GEOCODER "${name}"`);
  return provider(address);
}

module.exports = { geocode, formatAddress, MOCK_PLACES };
