import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getOrder } from '../api/orders';
import { useCart } from '../context/CartContext';
import { formatCurrency } from '../utils/formatCurrency';
import { shortId } from '../utils/orderStatus';

const POLL_MS = 2000;
const MAX_POLLS = 15;

/**
 * Stripe redirects here after payment. The redirect alone doesn't prove payment — the order is
 * only marked paid when the server receives Stripe's webhook, so we poll the order briefly.
 */
export default function OrderSuccess() {
  const [params] = useSearchParams();
  const orderId = params.get('orderId');
  const redirectStatus = params.get('redirect_status'); // added by Stripe: succeeded | processing | failed
  const { clearCart } = useCart();
  const [order, setOrder] = useState(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!orderId) return undefined;
    let polls = 0;
    let timer;
    const check = async () => {
      try {
        const o = await getOrder(orderId);
        setOrder(o);
        if (o.paymentStatus === 'paid' || o.paymentStatus === 'failed') return;
      } catch {
        /* keep polling */
      }
      polls += 1;
      if (polls >= MAX_POLLS) setTimedOut(true);
      else timer = setTimeout(check, POLL_MS);
    };
    check();
    return () => clearTimeout(timer);
  }, [orderId]);

  useEffect(() => {
    if (order?.paymentStatus === 'paid') clearCart();
  }, [order?.paymentStatus, clearCart]);

  if (!orderId) return <div className="container"><p>Missing order id.</p></div>;

  if (redirectStatus === 'failed' || order?.paymentStatus === 'failed') {
    return (
      <div className="container empty-state">
        <h1>Payment didn't go through</h1>
        <p>No charge was made. Your cart is still saved.</p>
        <Link to="/checkout" className="btn btn--primary">Try again</Link>
      </div>
    );
  }

  if (order?.paymentStatus === 'paid') {
    return (
      <div className="container empty-state">
        <h1>Thanks — order {shortId(order._id)} is confirmed!</h1>
        <p>We charged {formatCurrency(order.total)}. You can follow your delivery live on the map.</p>
        <Link to={`/orders/${order._id}/track`} className="btn btn--primary">Track my order</Link>
      </div>
    );
  }

  return (
    <div className="container empty-state">
      <h1>Confirming your payment…</h1>
      {timedOut ? (
        <p>
          This is taking longer than usual. If you're testing locally, make sure <code>stripe listen</code> is forwarding
          webhooks to the API. Check <Link to="/orders">My orders</Link> in a moment.
        </p>
      ) : (
        <p className="muted">This usually takes a few seconds.</p>
      )}
    </div>
  );
}
