import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../context/CartContext';
import { confirmMockPayment, createPaymentIntent } from '../api/payments';
import { getErrorData, getErrorMessage, getFieldErrors } from '../api/axios';
import AddressForm, { emptyAddress } from '../components/checkout/AddressForm';
import PaymentForm from '../components/checkout/PaymentForm';
import SmsOptIn, { emptySmsContact } from '../components/checkout/SmsOptIn';
import CartSummary, { estimateTotals } from '../components/cart/CartSummary';
import { formatCurrency } from '../utils/formatCurrency';

// Load Stripe.js once, outside the component (only if a publishable key is configured)
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const pickAddress = (a) => (a ? { line1: a.line1 || '', line2: a.line2 || '', city: a.city || '', province: a.province || 'ON', postalCode: a.postalCode || '' } : emptyAddress);

export default function Checkout() {
  const { user } = useAuth();
  const { items, subtotal, clearCart } = useCart();
  const navigate = useNavigate();

  const [address, setAddress] = useState(() => pickAddress(user?.address));
  const [contact, setContact] = useState(emptySmsContact);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState(null); // { orderId, provider, clientSecret, totals }

  useEffect(() => {
    if (!items.length && !intent) navigate('/cart', { replace: true });
  }, [items.length, intent, navigate]);

  // Step 1: send cart ids + address. The server geofences the address and prices the order.
  const handleContinue = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      const data = await createPaymentIntent(
        items.map((i) => ({ productId: i.productId, quantity: i.quantity, variantId: i.variantId })),
        address,
        contact.phone.trim() ? contact : undefined
      );
      setIntent(data);
    } catch (err) {
      const info = getErrorData(err);
      if (info.code === 'OUT_OF_SERVICE_AREA') {
        navigate('/out-of-service-area', { state: { distanceKm: info.distanceKm, message: info.message } });
        return;
      }
      setFieldErrors(Object.fromEntries(Object.entries(getFieldErrors(err)).map(([k, v]) => [k.replace('shippingAddress', 'address'), v])));
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  // Mock provider (dev): pretend the payment succeeded
  const handleMockPay = async () => {
    setBusy(true);
    try {
      await confirmMockPayment(intent.orderId);
      clearCart();
      navigate(`/order-success?orderId=${intent.orderId}`);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="container two-col">
      <section>
        <h1>Checkout</h1>
        {error && <p className="alert alert--error">{error}</p>}

        {!intent ? (
          <form onSubmit={handleContinue}>
            <AddressForm value={address} onChange={setAddress} errors={fieldErrors} />
            <SmsOptIn value={contact} onChange={setContact} errors={fieldErrors} />
            <p className="muted small">We deliver within 25 km of downtown Toronto. We'll confirm your address on the next step.</p>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Checking address…' : 'Continue to payment'}
            </button>
          </form>
        ) : (
          <div className="payment-step">
            <div className="address-confirmed">
              <strong>Delivering to</strong>
              <span>{address.line1}{address.line2 ? `, ${address.line2}` : ''}, {address.city} {address.postalCode}</span>
              <button type="button" className="link-button" onClick={() => setIntent(null)}>Change</button>
            </div>

            {intent.provider === 'mock' && (
              <div className="mock-pay">
                <p className="alert alert--info">
                  <strong>Test mode:</strong> the server is using the mock payment provider. Set <code>PAYMENT_PROVIDER=stripe</code>
                  {' '}and your Stripe keys to take real (test) card payments.
                </p>
                <button type="button" className="btn btn--primary btn--block" onClick={handleMockPay} disabled={busy}>
                  {busy ? 'Processing…' : `Simulate paying ${formatCurrency(intent.totals.total)}`}
                </button>
              </div>
            )}

            {intent.provider === 'stripe' &&
              (stripePromise ? (
                <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret, appearance: { theme: 'stripe' } }}>
                  <PaymentForm orderId={intent.orderId} total={intent.totals.total} />
                </Elements>
              ) : (
                <p className="alert alert--error">Set VITE_STRIPE_PUBLISHABLE_KEY in client/.env to show the card form.</p>
              ))}
          </div>
        )}
      </section>

      <aside>
        <CartSummary totals={intent?.totals || estimateTotals(subtotal)} estimated={!intent} />
        <Link to="/cart" className="muted small">← Edit cart</Link>
      </aside>
    </div>
  );
}
