import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import ProtectedRoute from './routes/ProtectedRoute';
import AdminRoute from './routes/AdminRoute';

import Home from './pages/Home';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Login from './pages/Login';
import NotFound from './pages/NotFound';

// Heavier pages (maps, Stripe, admin) are loaded on demand to keep the shop's first load small.
const Checkout = lazy(() => import('./pages/Checkout'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const MyOrders = lazy(() => import('./pages/MyOrders'));
const TrackOrder = lazy(() => import('./pages/TrackOrder'));
const Register = lazy(() => import('./pages/Register'));
const OutOfServiceArea = lazy(() => import('./pages/OutOfServiceArea'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const ManageProducts = lazy(() => import('./pages/admin/ManageProducts'));
const ManageOrders = lazy(() => import('./pages/admin/ManageOrders'));
const DriverConsole = lazy(() => import('./pages/driver/DriverConsole'));

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main className="main">
        <Suspense fallback={<div className="page-loading">Loading…</div>}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/products/:slug" element={<ProductDetail />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/out-of-service-area" element={<OutOfServiceArea />} />
          <Route path="/delivery-area" element={<OutOfServiceArea />} />

          {/* Logged-in customers */}
          <Route element={<ProtectedRoute />}>
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-success" element={<OrderSuccess />} />
            <Route path="/orders" element={<MyOrders />} />
            <Route path="/orders/:id/track" element={<TrackOrder />} />
          </Route>

          {/* Drivers (and admins) */}
          <Route element={<ProtectedRoute roles={['driver', 'admin']} />}>
            <Route path="/driver" element={<DriverConsole />} />
          </Route>

          {/* Admins */}
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/products" element={<ManageProducts />} />
            <Route path="/admin/orders" element={<ManageOrders />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
