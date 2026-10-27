import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyOrders } from '../api/orders';
import { getErrorMessage } from '../api/axios';
import { formatCurrency } from '../utils/formatCurrency';
import { STATUS_LABELS, shortId } from '../utils/orderStatus';

export default function MyOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyOrders().then(setOrders).catch((err) => setError(getErrorMessage(err)));
  }, []);

  if (error) return <div className="container"><p className="alert alert--error">{error}</p></div>;
  if (!orders) return <div className="container"><p className="muted">Loading…</p></div>;

  const visible = orders.filter((o) => o.paymentStatus !== 'pending'); // hide abandoned checkouts

  return (
    <div className="container">
      <h1>My orders</h1>
      {!visible.length && <p className="muted">No orders yet. <Link to="/">Start shopping</Link></p>}
      <div className="order-list">
        {visible.map((o) => (
          <div key={o._id} className="order-row">
            <div>
              <strong>{shortId(o._id)}</strong>
              <span className="muted small">{new Date(o.createdAt).toLocaleDateString('en-CA', { dateStyle: 'medium' })}</span>
            </div>
            <span>{o.items.reduce((n, i) => n + i.quantity, 0)} items · {formatCurrency(o.total)}</span>
            <span className={`status status--${o.status}`}>{o.paymentStatus === 'failed' ? 'Payment failed' : STATUS_LABELS[o.status]}</span>
            {o.paymentStatus === 'paid' && <Link to={`/orders/${o._id}/track`} className="btn btn--ghost btn--sm">Track</Link>}
          </div>
        ))}
      </div>
    </div>
  );
}
