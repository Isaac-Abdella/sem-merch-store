import { useState } from 'react';
import { setCarrierTracking } from '../../api/orders';
import { getErrorMessage } from '../../api/axios';
import { shortId } from '../../utils/orderStatus';

/**
 * Admin: hand a paid order to Canada Post by entering its tracking number (PIN).
 * Saving marks the order "shipped" (which texts opted-in customers); the tracking poller does the rest.
 */
export default function CarrierTrackingForm({ order, onSaved, onError }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  if (order.paymentStatus !== 'paid') return <span className="muted">—</span>;
  if (order.carrier === 'canada_post' && order.trackingNumber) {
    return <span className="small">{order.trackingNumber}</span>;
  }

  const save = async () => {
    if (!pin.trim()) return;
    setBusy(true);
    try {
      await setCarrierTracking(order._id, 'canada_post', pin.trim());
      setPin('');
      onSaved?.(`${shortId(order._id)} handed to Canada Post`);
    } catch (err) {
      onError?.(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="assign">
      <input
        className="input--sm"
        placeholder="Tracking #"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        aria-label="Canada Post tracking number"
      />
      <button type="button" className="btn btn--ghost btn--sm" onClick={save} disabled={busy || !pin.trim()}>
        {busy ? '…' : 'Ship'}
      </button>
    </div>
  );
}
