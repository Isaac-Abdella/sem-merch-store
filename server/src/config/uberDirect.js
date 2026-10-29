/**
 * Uber Direct (on-demand courier) settings.
 * Sign up at https://direct.uber.com → Developer tab → Customer ID, Client ID, Client secret.
 * Test-mode credentials hit Uber's sandbox and never dispatch a real courier.
 *
 * UBER_DIRECT_MODE:
 *   "mock" – no network calls; fake quotes/deliveries so you can try the flow locally
 *   "live" – calls the Uber Direct API (sandbox or production depending on your credentials)
 */
const serviceArea = require('./serviceArea');

function uberDirectConfig() {
  return {
    enabled: process.env.UBER_DIRECT_ENABLED === 'true',
    mode: (process.env.UBER_DIRECT_MODE || 'mock').toLowerCase(),
    apiBase: process.env.UBER_API_BASE || 'https://api.uber.com/v1',
    tokenUrl: process.env.UBER_TOKEN_URL || 'https://auth.uber.com/oauth/v2/token',
    customerId: process.env.UBER_CUSTOMER_ID,
    clientId: process.env.UBER_CLIENT_ID,
    clientSecret: process.env.UBER_CLIENT_SECRET,
    webhookSigningKey: process.env.UBER_WEBHOOK_SIGNING_KEY,
    // Where the courier picks up (your store / warehouse)
    pickup: {
      name: process.env.UBER_PICKUP_NAME || process.env.STORE_NAME || 'SEM Merch',
      phone: process.env.UBER_PICKUP_PHONE, // E.164, required by Uber
      line1: process.env.UBER_PICKUP_LINE1,
      line2: process.env.UBER_PICKUP_LINE2 || '',
      city: process.env.UBER_PICKUP_CITY || 'Toronto',
      province: process.env.UBER_PICKUP_PROVINCE || 'ON',
      postalCode: process.env.UBER_PICKUP_POSTAL_CODE,
      lat: Number(process.env.UBER_PICKUP_LAT || serviceArea.center.lat),
      lng: Number(process.env.UBER_PICKUP_LNG || serviceArea.center.lng),
      notes: process.env.UBER_PICKUP_NOTES || '',
    },
    // Rough parcel size for the courier (Uber uses it to pick a vehicle). Grams / centimetres.
    defaultItem: {
      weight: Number(process.env.UBER_ITEM_WEIGHT_G || 500),
      length: Number(process.env.UBER_ITEM_LENGTH_CM || 30),
      height: Number(process.env.UBER_ITEM_HEIGHT_CM || 10),
      depth: Number(process.env.UBER_ITEM_DEPTH_CM || 25),
    },
  };
}

module.exports = { uberDirectConfig };
