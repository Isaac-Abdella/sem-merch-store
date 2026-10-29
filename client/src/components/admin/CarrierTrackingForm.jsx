import { useState } from 'react';
import { cancelUberDirect, dispatchUberDirect, setCarrierTracking } from '../../api/orders';
import { getErrorMessage } from '../../api/axios';
import { shortId } from '../../utils/orderStatus';
import { formatCurrency as formatPrice } from '../../utils/formatCurrency';

/**
 * Admin: send a paid order with an Uber Direct courier, or hand it to Canada Post with a PIN.
 * Either way the order becomes "shipped" (opted-in customers get a text) and updates arrive automatically.
 */
export default function CarrierTrackingForm({ order, onSaved, onError }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  if (order.paymentStatus !== 'paid') return <span className="muted">—</span>;

  const run = async (fn, success) => {
    setBusy(true);
    try {
      const data = await fn();
      onSaved?.(success(data));
    } catch (err) {
      onError?.(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const uberActive = order.carrier === 'uber_direct' && !['canceled', 'returned'].includes(order.carrierStatus);
  if (uberActive) {
    return (
      <div className="small">
        Uber · {order.carrierStatus?.replace('_', ' ') || 'requested'}
        {order.carrierFee != null && <> · {formatPrice(order.carrierFee)}</>}
        <div className="assign">
          {order.trackingUrl && <a href={order.trackingUrl} target="_blank" rel="noreferrer">Track</a>}
          {['pending', 'pickup'].includes(order.carrierStatus) && (
            <button type="button" className="btn btn--ghost btn--sm" disabled={busy}
              onClick={() => run(() => cancelUberDirect(order._id), () => `Uber courier cancelled for ${shortId(order._id)}`)}>
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }
  if (order.carrier === 'canada_post' && order.trackingNumber) {
    return <span className="small">Canada Post · {order.trackingNumber}</span>;
  }
  if (['delivered', 'cancelled'].includes(order.status)) return <span className="muted">—</span>;

  return (
    <div className="carrier-actions">
      <button type="button" className="btn btn--primary btn--sm" disabled={busy}
        onClick={() => run(() => dispatchUberDirect(order._id),
          (d) => `Uber courier requested for ${shortId(order._id)}${d.delivery?.fee != null ? ` (${formatPrice(d.delivery.fee)})` : ''}`)}>
        {busy ? '…' : 'Send with Uber'}
      </button>
      <div className="assign">
        <input className="input--sm" placeholder="Canada Post #" value={pin}
          onChange={(e) => setPin(e.target.value)} aria-label="Canada Post tracking number" />
        <button type="button" className="btn btn--ghost btn--sm" disabled={busy || !pin.trim()}
          onClick={() => run(() => setCarrierTracking(order._id, 'canada_post', pin.trim()),
            () => { setPin(''); return `${shortId(order._id)} handed to Canada Post`; })}>
          Ship
        </button>
      </div>
    </div>
  );
}
