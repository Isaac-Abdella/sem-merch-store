/**
 * SMS settings. Mirrors the payments setup: "mock" logs texts to the console (dev/tests),
 * "twilio" sends real texts. Mock is the default so the app runs without any keys.
 */
function smsConfig() {
  const provider = (process.env.SMS_PROVIDER || 'mock').toLowerCase();
  return {
    provider,
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_FROM_NUMBER, // E.164, e.g. +14165550123
    },
    storeName: process.env.STORE_NAME || 'SEM Merch',
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  };
}

module.exports = { smsConfig };
