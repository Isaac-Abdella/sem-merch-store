import { useState } from 'react';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { formatCurrency } from '../../utils/formatCurrency';

/**
 * Stripe Payment Element. Card details go straight from the browser to Stripe —
 * they never touch your server, which keeps your PCI scope minimal.
 * Must be rendered inside <Elements stripe={...} options={{ clientSecret }}>.
 */
export default function PaymentForm({ orderId, total }) {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setMessage('');

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Stripe redirects here after payment (and after 3-D Secure if the bank requires it)
        return_url: `${window.location.origin}/order-success?orderId=${orderId}`,
      },
    });

    // Only reached if there was an immediate error (e.g. card declined). Otherwise we're redirected.
    setMessage(error?.message || 'Payment could not be completed');
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <PaymentElement />
      {message && <p className="alert alert--error">{message}</p>}
      <button type="submit" className="btn btn--primary btn--block" disabled={!stripe || submitting}>
        {submitting ? 'Processing…' : `Pay ${formatCurrency(total)}`}
      </button>
      <p className="muted small">Test card: 4242 4242 4242 4242, any future date, any CVC.</p>
    </form>
  );
}
