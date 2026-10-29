/**
 * Minimal Uber Direct REST client: OAuth client-credentials token (scope eats.deliveries, cached ~30 days)
 * plus JSON helpers scoped to your customer ID.
 */
const { uberDirectConfig } = require('../config/uberDirect');

let cached = { token: null, expiresAt: 0 };

async function getToken() {
  if (cached.token && Date.now() < cached.expiresAt) return cached.token;
  const cfg = uberDirectConfig();
  if (!cfg.clientId || !cfg.clientSecret || !cfg.customerId) {
    throw new Error('Uber Direct is not configured (UBER_CLIENT_ID, UBER_CLIENT_SECRET, UBER_CUSTOMER_ID)');
  }
  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: 'client_credentials',
      scope: 'eats.deliveries',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`Uber token error ${res.status}`);
  cached = { token: data.access_token, expiresAt: Date.now() + ((data.expires_in || 3600) - 300) * 1000 };
  return cached.token;
}

async function uberRequest(method, path, body) {
  const cfg = uberDirectConfig();
  const res = await fetch(`${cfg.apiBase}/customers/${cfg.customerId}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await getToken()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) cached = { token: null, expiresAt: 0 };
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Uber Direct ${res.status}: ${data.message || data.code || 'request failed'}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

module.exports = { uberRequest, _resetToken: () => (cached = { token: null, expiresAt: 0 }) };
