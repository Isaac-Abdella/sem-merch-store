import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getTracking } from '../api/tracking';
import { getErrorMessage } from '../api/axios';
import { useOrderSocket } from '../hooks/useOrderSocket';
import TrackingMap from '../components/map/TrackingMap';
import { STATUS_LABELS, TRACKING_STEPS, shortId } from '../utils/orderStatus';

export default function TrackOrder() {
  const { id } = useParams();
  const [data, setData] = useState(null); // { order, shipment }
  const [error, setError] = useState('');

  useEffect(() => {
    getTracking(id).then(setData).catch((err) => setError(getErrorMessage(err)));
  }, [id]);

  // Live updates pushed by the server over Socket.io
  const handleUpdate = useCallback((update) => {
    setData((prev) => {
      if (!prev) return prev;
      const order = { ...prev.order };
      if (update.status && update.status !== order.status) {
        order.status = update.status;
        order.statusHistory = [...order.statusHistory, { status: update.status, note: update.note, at: update.at }];
      }
      const shipment = prev.shipment ? { ...prev.shipment } : null;
      if (shipment && update.location) {
        shipment.currentLocation = update.location;
        shipment.lastLocationAt = update.at;
        shipment.path = [...shipment.path, { ...update.location, at: update.at }];
      }
      return { order, shipment };
    });
  }, []);

  const { connected } = useOrderSocket(id, handleUpdate);

  if (error) return <div className="container"><p className="alert alert--error">{error}</p></div>;
  if (!data) return <div className="container"><p className="muted">Loading tracking…</p></div>;

  const { order, shipment } = data;
  const destination = shipment?.destination || order.shippingAddress?.location;
  const stepIndex = TRACKING_STEPS.indexOf(order.status);

  return (
    <div className="container track">
      <div className="track__header">
        <div>
          <Link to="/orders" className="muted small">← My orders</Link>
          <h1>Order {shortId(order._id)}</h1>
          <p className="lead">{STATUS_LABELS[order.status]}</p>
        </div>
        <span className={`live-dot ${connected ? 'live-dot--on' : ''}`}>{connected ? 'Live' : 'Offline'}</span>
      </div>

      {order.status === 'cancelled' ? (
        <p className="alert alert--error">This order was cancelled.</p>
      ) : (
        <ol className="steps">
          {TRACKING_STEPS.map((s, i) => (
            <li key={s} className={i <= stepIndex ? 'steps__done' : ''}>{STATUS_LABELS[s]}</li>
          ))}
        </ol>
      )}

      <TrackingMap origin={shipment?.origin} destination={destination} current={shipment?.currentLocation} path={shipment?.path} />

      <div className="track__meta">
        <div>
          <h3>Delivering to</h3>
          <p>
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
            <br />
            {order.shippingAddress.city}, {order.shippingAddress.province} {order.shippingAddress.postalCode}
          </p>
          {shipment?.driver && <p className="muted">Driver: {shipment.driver.name}</p>}
          {shipment?.lastLocationAt && (
            <p className="muted small">Last update {new Date(shipment.lastLocationAt).toLocaleTimeString('en-CA')}</p>
          )}
        </div>
        <div>
          <h3>History</h3>
          <ul className="history">
            {[...order.statusHistory].reverse().map((h, i) => (
              <li key={i}>
                <strong>{STATUS_LABELS[h.status] || h.status}</strong>
                {h.note && <span> — {h.note}</span>}
                <span className="muted small"> {new Date(h.at).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
