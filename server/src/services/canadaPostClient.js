/**
 * Minimal Canada Post REST client: gets and caches an OAuth 2.0 bearer token, then makes JSON calls.
 */
const { canadaPostConfig } = require('../config/canadaPost');

let cached = { token: null, expiresAt: 0 };

async function getToken() {
  if (cached.token && Date.now() < cached.expiresAt) return cached.token;
  const cfg = canadaPostConfig();
  if (!cfg.tokenUrl || !cfg.apiKey || !cfg.apiSecret) {
    throw new Error('Canada Post is not configured (CP_TOKEN_URL, CP_API_KEY, CP_API_SECRET)');
  }
  const form = new URLSearchParams({ grant_type: 'client_credentials' });
  if (cfg.tokenScope) form.set('scope', cfg.tokenScope);

  const res = await fetch(cfg.tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`Canada Post token error ${res.status}`);

  cached = { token: data.access_token, expiresAt: Date.now() + ((data.expires_in || 3600) - 60) * 1000 };
  return cached.token;
}

async function cpGet(path) {
  const { apiBase } = canadaPostConfig();
  const res = await fetch(`${apiBase}${path}`, {
    headers: { Authorization: `Bearer ${await getToken()}`, Accept: 'application/json' },
  });
  if (res.status === 401) cached = { token: null, expiresAt: 0 }; // force a new token next time
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Canada Post ${res.status} on ${path}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

module.exports = { cpGet, _resetToken: () => (cached = { token: null, expiresAt: 0 }) };
