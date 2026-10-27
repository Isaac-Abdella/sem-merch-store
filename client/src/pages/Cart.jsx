import { Link, useNavigate } from 'react-router-dom';
import { lineKey, useCart } from '../context/CartContext';
import CartItem from '../components/cart/CartItem';
import CartSummary, { estimateTotals } from '../components/cart/CartSummary';

export default function Cart() {
  const { items, subtotal } = useCart();
  const navigate = useNavigate();

  if (!items.length) {
    return (
      <div className="container empty-state">
        <h1>Your cart is empty</h1>
        <Link to="/" className="btn btn--primary">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="container two-col">
      <section>
        <h1>Cart</h1>
        {items.map((item) => (
          <CartItem key={lineKey(item.productId, item.variantId)} item={item} />
        ))}
      </section>
      <aside>
        <CartSummary totals={estimateTotals(subtotal)} estimated>
          <button type="button" className="btn btn--primary btn--block" onClick={() => navigate('/checkout')}>
            Checkout
          </button>
        </CartSummary>
      </aside>
    </div>
  );
}
