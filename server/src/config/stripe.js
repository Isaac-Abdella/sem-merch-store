const Stripe = require('stripe');

let client = null;

/**
 * Returns a Stripe client, or null when no secret key is configured.
 * Created lazily so the app (and tests) can run with the mock provider.
 */
function getStripe() {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key === 'sk_test_xxx') return null;
  client = new Stripe(key);
  return client;
}

module.exports = { getStripe };
