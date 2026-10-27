import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAllOrders } from '../../api/orders';
import { listAllProducts } from '../../api/products';
import { getErrorMessage } from '../../api/axios';
import { formatCurrency } from '../../utils/formatCurrency';
import { ORDER_STATUSES, STATUS_LABELS } from '../../utils/orderStatus';

export default function Dashboard() {
  const [orders, setOrders] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getAllOrders(), listAllProducts()])
      .then(([o, p]) => {
        setOrders(o);
        setProducts(p);
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  if (error) return <div className="container"><p className="alert alert--error">{error}</p></div>;
  if (!orders) return <div className="container"><p className="muted">Loading…</p></div>;

  const paid = orders.filter((o) => o.paymentStatus === 'paid');
  const revenue = paid.reduce((sum, o) => sum + o.total, 0);
  const lowStock = products.filter((p) => p.active && p.stock < 5);
  const countBy = (status) => paid.filter((o) => o.status === status).length;

  return (
    <div className="container">
      <div className="page-head">
        <h1>Admin</h1>
        <nav className="chips">
          <Link to="/admin/orders" className="chip">Manage orders</Link>
          <Link to="/admin/products" className="chip">Manage products</Link>
        </nav>
      </div>

      <div className="stats">
        <div className="stat"><span>Revenue (paid)</span><strong>{formatCurrency(revenue)}</strong></div>
        <div className="stat"><span>Paid orders</span><strong>{paid.length}</strong></div>
        <div className="stat"><span>Active products</span><strong>{products.filter((p) => p.active).length}</strong></div>
        <div className="stat"><span>Low stock</span><strong>{lowStock.length}</strong></div>
      </div>

      <div className="two-col two-col--even">
        <section className="panel">
          <h3>Orders by status</h3>
          <ul className="kv">
            {ORDER_STATUSES.filter((s) => s !== 'pending').map((s) => (
              <li key={s}><span>{STATUS_LABELS[s]}</span><strong>{countBy(s)}</strong></li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h3>Low stock</h3>
          {lowStock.length ? (
            <ul className="kv">
              {lowStock.map((p) => <li key={p._id}><span>{p.name}</span><strong>{p.stock}</strong></li>)}
            </ul>
          ) : (
            <p className="muted">Everything is well stocked.</p>
          )}
        </section>
      </div>
    </div>
  );
}
