/**
 * Optional "text me updates" checkbox + mobile number at checkout.
 * Consent must be an unticked box the customer checks themselves (CASL). The server
 * re-validates the number and records the consent time on the order.
 */
export const emptySmsContact = { smsOptIn: false, phone: '' };

export default function SmsOptIn({ value, onChange, errors = {} }) {
  const phoneError = errors['contact.phone'];

  return (
    <fieldset className="sms-opt-in">
      <legend>Delivery updates</legend>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={value.smsOptIn}
          onChange={(e) => onChange({ ...value, smsOptIn: e.target.checked })}
        />
        <span>Text me when my order ships, is out for delivery and is delivered</span>
      </label>

      {value.smsOptIn && (
        <label>
          Mobile number
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="416-555-0123"
            value={value.phone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
            required
          />
          {phoneError && <span className="field-error">{phoneError}</span>}
          <span className="muted small">Message and data rates may apply. Reply STOP to opt out at any time.</span>
        </label>
      )}
    </fieldset>
  );
}
