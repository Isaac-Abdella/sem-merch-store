import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createProduct, deleteProduct, deleteProductPermanently, listAllProducts, updateProduct } from '../../api/products';
import { getErrorMessage, getFieldErrors } from '../../api/axios';
import { centsToDollars, dollarsToCents, formatCurrency } from '../../utils/formatCurrency';
import { hasOptions, hasPriceRange, optionTypeLabel } from '../../utils/productOptions';
import OptionsEditor, { toApiVariants, toFormRows } from '../../components/admin/OptionsEditor';

const blank = { name: '', price: '', stock: '', category: '', image: '', description: '', optionType: 'none', rows: [] };

/** Inline panel under a product row for changing its option type and options. */
function ProductOptionsPanel({ product, onSaved, onCancel }) {
  const [optionType, setOptionType] = useState(product.optionType || 'none');
  const [rows, setRows] = useState(() => toFormRows(product.variants));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setErrors({});
    setError('');
    try {
      await updateProduct(product._id, { optionType, variants: optionType === 'none' ? [] : toApiVariants(rows) });
      onSaved(`Saved options for "${product.name}"`);
    } catch (err) {
      setErrors(getFieldErrors(err));
      setError(getErrorMessage(err));
    }
  };

  return (
    <form className="options-panel" onSubmit={handleSave}>
      {error && <p className="alert alert--error">{error}</p>}
      <OptionsEditor optionType={optionType} rows={rows} onTypeChange={setOptionType} onRowsChange={setRows} errors={errors} />
      {optionType === 'none' && hasOptions(product) && (
        <p className="muted small">The product will keep a single price of {formatCurrency(product.price)} and stock of {product.stock}. You can edit both in the table after saving.</p>
      )}
      <div className="button-row">
        <button type="submit" className="btn btn--primary btn--sm">Save options</button>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function ManageProducts() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);

  const load = () => listAllProducts().then(setProducts).catch((err) => setMessage(getErrorMessage(err)));
  useEffect(() => {
    load();
  }, []);

  const set = (f) => (e) => setForm({ ...form, [f]: e.target.value });
  const withOptions = form.optionType !== 'none';

  const handleCreate = async (e) => {
    e.preventDefault();
    setErrors({});
    try {
      await createProduct({
        name: form.name,
        // With options, each option carries its own price and stock instead
        ...(withOptions
          ? { optionType: form.optionType, variants: toApiVariants(form.rows) }
          : { price: dollarsToCents(form.price), stock: Number(form.stock || 0) }), // the API stores cents
        category: form.category || undefined,
        image: form.image || undefined,
        description: form.description || undefined,
      });
      setForm(blank);
      setMessage('Product created');
      load();
    } catch (err) {
      setErrors(getFieldErrors(err));
      setMessage(getErrorMessage(err));
    }
  };

  const patch = async (id, data) => {
    try {
      await updateProduct(id, data);
      load();
    } catch (err) {
      setMessage(getErrorMessage(err));
    }
  };

  const handleDeactivate = async (p) => {
    if (!window.confirm(`Hide "${p.name}" from the shop?`)) return;
    await deleteProduct(p._id);
    load();
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Permanently delete "${p.name}"? This can't be undone. Past orders keep their copy of the item.`)) return;
    try {
      await deleteProductPermanently(p._id);
      setMessage(`Deleted "${p.name}"`);
      load();
    } catch (err) {
      setMessage(getErrorMessage(err));
    }
  };

  const handleOptionsSaved = (msg) => {
    setEditingId(null);
    setMessage(msg);
    load();
  };

  return (
    <div className="container">
      <div className="page-head">
        <h1>Products</h1>
        <Link to="/admin" className="muted">← Dashboard</Link>
      </div>
      {message && <p className="alert alert--info">{message}</p>}

      <form className="panel product-form" onSubmit={handleCreate}>
        <h3>Add a product</h3>
        <div className="form-row">
          <label>Name<input value={form.name} onChange={set('name')} required />{errors.name && <span className="field-error">{errors.name}</span>}</label>
          {!withOptions && (
            <>
              <label>Price (CAD)<input type="number" step="0.01" min="0" value={form.price} onChange={set('price')} required />{errors.price && <span className="field-error">{errors.price}</span>}</label>
              <label>Stock<input type="number" min="0" value={form.stock} onChange={set('stock')} /></label>
            </>
          )}
          <label>Category<input value={form.category} onChange={set('category')} placeholder="apparel" /></label>
        </div>
        <label>Image URL<input value={form.image} onChange={set('image')} placeholder="/images/photo.jpg or https://…" /></label>
        <OptionsEditor
          optionType={form.optionType}
          rows={form.rows}
          onTypeChange={(optionType) => setForm((f) => ({ ...f, optionType }))}
          onRowsChange={(rows) => setForm((f) => ({ ...f, rows }))}
          errors={errors}
        />
        <label>Description<textarea rows={2} value={form.description} onChange={set('description')} /></label>
        <button type="submit" className="btn btn--primary">Add product</button>
      </form>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <Fragment key={p._id}>
                <tr className={p.active ? '' : 'row--muted'}>
                  <td>
                    <Link to={`/products/${p.slug}`}>{p.name}</Link>
                    {hasOptions(p) && (
                      <span className="muted small option-summary">
                        {optionTypeLabel(p.optionType)}: {p.variants.map((v) => v.label).join(', ')}
                      </span>
                    )}
                  </td>
                  <td>{p.category}</td>
                  {hasOptions(p) ? (
                    <>
                      {/* Set per option — use the Options button */}
                      <td>{hasPriceRange(p) && 'From '}{formatCurrency(p.price)}</td>
                      <td>{p.stock}</td>
                    </>
                  ) : (
                    <>
                      <td>
                        <input
                          className="input--sm"
                          type="number"
                          step="0.01"
                          defaultValue={centsToDollars(p.price)}
                          aria-label={`Price for ${p.name}`}
                          onBlur={(e) => dollarsToCents(e.target.value) !== p.price && patch(p._id, { price: dollarsToCents(e.target.value) })}
                        />
                        <span className="sr-only">{formatCurrency(p.price)}</span>
                      </td>
                      <td>
                        <input
                          className="input--sm"
                          type="number"
                          min="0"
                          defaultValue={p.stock}
                          aria-label={`Stock for ${p.name}`}
                          onBlur={(e) => Number(e.target.value) !== p.stock && patch(p._id, { stock: Number(e.target.value) })}
                        />
                      </td>
                    </>
                  )}
                  <td>{p.active ? 'Live' : 'Hidden'}</td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setEditingId(editingId === p._id ? null : p._id)}
                      aria-expanded={editingId === p._id}
                    >
                      Options
                    </button>
                    {p.active ? (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleDeactivate(p)}>Hide</button>
                    ) : (
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => patch(p._id, { active: true })}>Restore</button>
                    )}
                    <button type="button" className="btn btn--danger btn--sm" onClick={() => handleDelete(p)}>Delete</button>
                  </td>
                </tr>
                {editingId === p._id && (
                  <tr className="options-row">
                    <td colSpan={6}>
                      <ProductOptionsPanel product={p} onSaved={handleOptionsSaved} onCancel={() => setEditingId(null)} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
