import { centsToDollars, dollarsToCents } from '../../utils/formatCurrency';
import { OPTION_TYPES, optionPlaceholder, optionTypeLabel } from '../../utils/productOptions';

let nextKey = 0;
const newRow = (row = {}) => ({ key: `row-${nextKey++}`, label: '', price: '', stock: '', ...row });

/** API variants (cents) → editable form rows (dollar strings). Keeps _id so carts keep pointing at the option. */
export const toFormRows = (variants = []) =>
  variants.map((v) => newRow({ _id: v._id, label: v.label, price: centsToDollars(v.price), stock: String(v.stock) }));

/** Form rows → API variants. */
export const toApiVariants = (rows) =>
  rows.map(({ _id, label, price, stock }) => ({
    ...(_id && { _id }),
    label: label.trim(),
    price: dollarsToCents(price),
    stock: Number(stock || 0),
  }));

/**
 * Picks the option type (size / weight / volume / none) and edits that product's options,
 * each with its own price and stock. errors: field errors from the API, e.g. { 'variants.0.label': '…' }.
 */
export default function OptionsEditor({ optionType, rows, onTypeChange, onRowsChange, errors = {} }) {
  const update = (key, field) => (e) => onRowsChange(rows.map((r) => (r.key === key ? { ...r, [field]: e.target.value } : r)));
  const remove = (key) => onRowsChange(rows.filter((r) => r.key !== key));

  const changeType = (e) => {
    const type = e.target.value;
    onTypeChange(type);
    // Give the admin a first row to fill in when switching on options
    if (type !== 'none' && rows.length === 0) onRowsChange([newRow()]);
  };

  return (
    <div className="options-editor">
      <label className="options-editor__type">
        Options
        <select value={optionType} onChange={changeType}>
          {OPTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.value === 'none' ? t.label : `By ${t.label.toLowerCase()}`}</option>
          ))}
        </select>
      </label>

      {optionType !== 'none' && (
        <>
          <p className="muted small">Each {optionTypeLabel(optionType).toLowerCase()} has its own price and stock. Shoppers pick one before adding to cart.</p>
          {errors.variants && <p className="field-error">{errors.variants}</p>}
          {rows.map((r, i) => (
            <div key={r.key} className="form-row options-editor__row">
              <label>
                {optionTypeLabel(optionType)}
                <input value={r.label} onChange={update(r.key, 'label')} placeholder={optionPlaceholder(optionType)} required />
                {errors[`variants.${i}.label`] && <span className="field-error">{errors[`variants.${i}.label`]}</span>}
              </label>
              <label>
                Price (CAD)
                <input type="number" step="0.01" min="0" value={r.price} onChange={update(r.key, 'price')} required />
              </label>
              <label>
                Stock
                <input type="number" min="0" value={r.stock} onChange={update(r.key, 'stock')} />
              </label>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => remove(r.key)} disabled={rows.length === 1} aria-label={`Remove option ${r.label || i + 1}`}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onRowsChange([...rows, newRow()])}>
            + Add {optionTypeLabel(optionType).toLowerCase()}
          </button>
        </>
      )}
    </div>
  );
}
