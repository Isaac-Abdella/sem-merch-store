/**
 * Sends one SMS. Uses Twilio's REST API directly through fetch (Node 20+), so there's no extra
 * dependency. Swap this file to change providers (Telnyx, Vonage, AWS SNS...).
 */
const { smsConfig } = require('../config/sms');
const { maskPhone } = require('../utils/phone');

const sentInMock = []; // lets tests inspect "sent" messages

async function sendSms(to, body) {
  const cfg = smsConfig();

  if (cfg.provider === 'mock' || process.env.NODE_ENV === 'test') {
    sentInMock.push({ to, body, at: new Date() });
    if (process.env.NODE_ENV !== 'test') console.log(`[sms:mock] to ${maskPhone(to)}: ${body}`);
    return { provider: 'mock', id: `mock_${sentInMock.length}` };
  }

  if (cfg.provider !== 'twilio') throw new Error(`Unknown SMS_PROVIDER "${cfg.provider}"`);
  const { accountSid, authToken, fromNumber } = cfg.twilio;
  if (!accountSid || !authToken || !fromNumber) throw new Error('Twilio credentials are not configured');

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Twilio error ${res.status}: ${data.message || 'unknown'}`);
    err.code = data.code; // 21610 = recipient replied STOP (Twilio blocks further texts)
    throw err;
  }
  return { provider: 'twilio', id: data.sid };
}

module.exports = { sendSms, sentInMock };
