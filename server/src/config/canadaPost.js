/**
 * Canada Post Developer Portal (REST + OAuth 2.0) settings.
 * Get the API key/secret from the portal's Apps page. Copy the token URL and scope from the
 * portal's "Try it" tab / developer guide (the docs don't publish them on the public pages).
 */
function canadaPostConfig() {
  return {
    enabled: process.env.CANADA_POST_ENABLED === 'true',
    apiBase:
      process.env.CP_API_BASE ||
      'https://api.canadapost-postescanada.ca/prod/devportal-portaildesdeveloppeurs',
    tokenUrl: process.env.CP_TOKEN_URL,
    tokenScope: process.env.CP_TOKEN_SCOPE || '',
    apiKey: process.env.CP_API_KEY,
    apiSecret: process.env.CP_API_SECRET,
    // How often the in-process poller checks Canada Post (0 = off; use the one-shot script instead)
    pollMinutes: Number(process.env.CARRIER_POLL_MINUTES || 0),
  };
}

module.exports = { canadaPostConfig };
