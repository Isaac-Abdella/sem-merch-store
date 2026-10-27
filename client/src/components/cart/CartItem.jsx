import { Link } from 'react-router-dom';
import { lineKey, useCart } from '../../context/CartContext';
import { formatCurrency } from '../../utils/formatCurrency';
import { optionTypeLabel } from '../../utils/productOptions';

export default function CartItem({ item }) {
  const { updateQuantity, removeItem } = useCart();
  const max = Math.min(item.stock || 20, 20);
  const id = `qty-${lineKey(item.productId, item.variantId)}`;

  return (
    <div className="cart-item">
      {item.image ? <img src={item.image} alt="" /> : <div className="img-placeholder" />}
      <div className="cart-item__info">
        <Link to={`/products/${item.slug}`}>{item.name}</Link>
        {item.optionLabel && <span className="muted">{optionTypeLabel(item.optionType)}: {item.optionLabel}</span>}
        <span className="muted">{formatCurrency(item.price)} each</span>
      </div>
      <label className="sr-only" htmlFor={id}>Quantity</label>
      <select
        id={id}
        value={item.quantity}
        onChange={(e) => updateQuantity(item.productId, item.variantId, Number(e.target.value))}
      >
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <strong className="cart-item__total">{formatCurrency(item.price * item.quantity)}</strong>
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => removeItem(item.productId, item.variantId)}>
        Remove
      </button>
    </div>
  );
}
