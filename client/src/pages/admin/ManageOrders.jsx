import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { assignDriver, getAllOrders, updateOrderStatus } from '../../api/orders';
import CarrierTrackingForm from '../../components/admin/CarrierTrackingForm';
import { getErrorMessage } from '../../api/axios';
import { formatCurrency } from '../../utils/formatCurrency';
import { ORDER_STATUSES, STATUS_LABELS, shortId } from '../../utils/orderStatus';

export default function ManageOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [message, setMessage] = useState('');
  const [driverEmails, setDriverEmails] = useState({});

  const load = () =>
    getAllOrders(filter ? { status: filter } : {})
      .then(setOrders)
      .catch((err) => setMessage(getErrorMessage(err)));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const changeStatus = async (order, status) => {
    try {
      await updateOrderStatus(order._id, status);
      setMessage(`${shortId(order._id)} → ${STATUS_LABELS[status]}`);
      load();
    } catch (err) {
      setMessage(getErrorMessage(err));
    }
  };

  const handleAssign = async (order) => {
    const email = driverEmails[order._id] || 'driver@example.com';
    try {
      const { driver } = await assignDriver(order._id, email);
      setMessage(`${shortId(order._id)} assigned to ${driver.name}`);
      load();
    } catch (err) {
      setMessage(getErrorMessage(err));
    }
  };

  return (
    <div className="container">
      <div className="page-head">
        <h1>Orders</h1>
        <Link to="/admin" className="muted">← Dashboard</Link>
      </div>

      <div className="toolbar">
        <label>
          Status{' '}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">All</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
      </div>
      {message && <p className="alert alert--info">{message}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th><th>Driver</th><th>Canada Post</th><th /></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o._id}>
                <td>
                  {shortId(o._id)}
                  <div className="muted small">{new Date(o.createdAt).toLocaleString('en-CA', { dateStyle: 'short', timeStyle: 'short' })}</div>
                </td>
                <td>{o.user?.name}<div className="muted small">{o.shippingAddress?.city} · {o.distanceKm} km</div></td>
                <td>{formatCurrency(o.total)}</td>
                <td><span className={`status status--${o.paymentStatus}`}>{o.paymentStatus}</span></td>
                <td>
                  <select value={o.status} onChange={(e) => changeStatus(o, e.target.value)} disabled={o.paymentStatus !== 'paid'} aria-label="Order status">
                    {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </td>
                <td>
                  {o.driver ? (
                    o.driver.name
                  ) : o.paymentStatus === 'paid' ? (
                    <div className="assign">
                      <input
                        className="input--sm"
                        type="email"
                        placeholder="driver@example.com"
                        value={driverEmails[o._id] || ''}
                        onChange={(e) => setDriverEmails({ ...driverEmails, [o._id]: e.target.value })}
                        aria-label="Driver email"
                      />
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => handleAssign(o)}>Assign</button>
                    </div>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <CarrierTrackingForm
                    order={o}
                    onSaved={(text) => { setMessage(text); load(); }}
                    onError={setMessage}
                  />
                </td>
                <td>{o.paymentStatus === 'paid' && <Link to={`/orders/${o._id}/track`}>Track</Link>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders.length && <p className="muted">No orders.</p>}
      </div>
    </div>
  );
}
