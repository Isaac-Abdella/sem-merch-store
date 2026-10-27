import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getProduct } from '../api/products';
import { getErrorMessage } from '../api/axios';
import { useCart } from '../context/CartContext';
import { formatCurrency } from '../utils/formatCurrency';
import { hasOptions, optionTypeLabel } from '../utils/productOptions';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    getProduct(slug)
      .then((p) => {
        setProduct(p);
        // Start on the first option that's in stock
        setVariantId((p.variants?.find((v) => v.stock > 0) || p.variants?.[0])?._id || '');
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [slug]);

  if (error) return <div className="container"><p className="alert alert--error">{error}</p><Link to="/">← Back to shop</Link></div>;
  if (!product) return <div className="container"><p className="muted">Loading…</p></div>;

  const variant = hasOptions(product) ? product.variants.find((v) => v._id === variantId) : null;
  // Price and stock come from the chosen option when the product has options
  const { price, stock } = variant || product;
  const soldOut = stock <= 0;

  const chooseVariant = (id) => {
    setVariantId(id);
    setQuantity(1);
    setAdded(false);
  };

  const handleAdd = () => {
    addItem(product, quantity, variant);
    setAdded(true);
  };

  return (
    <div className="container product-detail">
      <div className="product-detail__image">
        {product.image ? <img src={product.image} alt={product.name} /> : <div className="img-placeholder" />}
      </div>
      <div className="product-detail__info">
        <Link to="/" className="muted small">← All products</Link>
        <h1>{product.name}</h1>
        <p className="price">{formatCurrency(price)}</p>
        <p>{product.description}</p>

        {hasOptions(product) && (
          <div className="option-picker">
            <span className="option-picker__label">
              {optionTypeLabel(product.optionType)}: <strong>{variant?.label}</strong>
            </span>
            <div className="chips" role="radiogroup" aria-label={optionTypeLabel(product.optionType)}>
              {product.variants.map((v) => (
                <button
                  key={v._id}
                  type="button"
                  role="radio"
                  aria-checked={variantId === v._id}
                  className={`chip chip--option ${variantId === v._id ? 'chip--active' : ''} ${v.stock <= 0 ? 'chip--soldout' : ''}`}
                  onClick={() => chooseVariant(v._id)}
                  title={v.stock <= 0 ? 'Sold out' : formatCurrency(v.price)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="form-row form-row--inline">
          <label>
            Qty
            <select value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} disabled={soldOut}>
              {Array.from({ length: Math.min(stock, 10) || 1 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn--primary" onClick={handleAdd} disabled={soldOut}>
            {soldOut ? 'Sold out' : 'Add to cart'}
          </button>
        </div>
        {stock > 0 && stock < 5 && <p className="muted small">Only {stock} left in stock.</p>}
        {added && (
          <p className="alert alert--success">
            Added to cart. <button type="button" className="link-button" onClick={() => navigate('/cart')}>View cart →</button>
          </p>
        )}
      </div>
    </div>
  );
}
