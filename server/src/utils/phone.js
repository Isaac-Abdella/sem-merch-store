/**
 * Normalizes a Canadian/US phone number to E.164 (+1XXXXXXXXXX), which SMS providers require.
 * Returns null if it isn't a valid 10-digit North American number.
 */
function toE164(input) {
  if (!input) return null;
  let digits = String(input).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  // Area code and exchange can't start with 0 or 1 (NANP rules)
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  return `+1${digits}`;
}

/** "+14165550123" → "•••-•••-0123" for logs and admin screens */
function maskPhone(e164) {
  return e164 ? `•••-•••-${e164.slice(-4)}` : '';
}

module.exports = { toE164, maskPhone };
