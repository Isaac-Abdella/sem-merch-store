/** Controlled address fields shared by Register and Checkout. */
export const emptyAddress = { line1: '', line2: '', city: '', province: 'ON', postalCode: '' };

export default function AddressForm({ value, onChange, errors = {}, prefix = 'address' }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  const err = (field) => errors[`${prefix}.${field}`];

  return (
    <fieldset className="address-form">
      <legend>Delivery address</legend>
      <label>
        Street address
        <input value={value.line1} onChange={set('line1')} autoComplete="address-line1" required />
        {err('line1') && <span className="field-error">{err('line1')}</span>}
      </label>
      <label>
        Apartment, unit (optional)
        <input value={value.line2 || ''} onChange={set('line2')} autoComplete="address-line2" />
      </label>
      <div className="form-row">
        <label>
          City
          <input value={value.city} onChange={set('city')} autoComplete="address-level2" required />
          {err('city') && <span className="field-error">{err('city')}</span>}
        </label>
        <label>
          Province
          <select value={value.province} onChange={set('province')} autoComplete="address-level1">
            <option value="ON">Ontario</option>
          </select>
        </label>
        <label>
          Postal code
          <input value={value.postalCode} onChange={set('postalCode')} autoComplete="postal-code" placeholder="M5H 2N2" required />
          {err('postalCode') && <span className="field-error">{err('postalCode')}</span>}
        </label>
      </div>
    </fieldset>
  );
}
