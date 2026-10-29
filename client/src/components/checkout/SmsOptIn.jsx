/**
 * Mobile number + optional "text me updates" checkbox at checkout.
 * The phone is optional, but couriers (Uber Direct) need it to reach the customer.
 * Text consent must be an unticked box the customer checks themselves (CASL); the server
 * re-validates the number and records the consent time on the order.
 */
export const emptySmsContact = { smsOptIn: false, phone: '' };

export default function SmsOptIn({ value, onChange, errors = {} }) {
  const phoneError = errors['contact.phone'];

  return (
    <fieldset className="sms-opt-in">
      <legend>Contact for delivery</legend>
      <label>
        Mobile number {value.smsOptIn ? '' : <span className="muted small">(optional, lets the courier reach you)</span>}
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="416-555-0123"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          required={value.smsOptIn}
        />
        {phoneError && <span className="field-error">{phoneError}</span>}
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={value.smsOptIn}
          onChange={(e) => onChange({ ...value, smsOptIn: e.target.checked })}
        />
        <span>
          Text me when my order ships, is out for delivery and is delivered.
          <span className="muted small"> Message and data rates may apply. Reply STOP to opt out.</span>
        </span>
      </label>
    </fieldset>
  );
}
