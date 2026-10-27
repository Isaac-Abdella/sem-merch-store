/**
 * Thin wrapper around the payment provider so controllers never talk to Stripe directly.
 * To add Helcim/Moneris later, add another provider here with the same function shapes.
 */
const crypto = require('crypto');
const { getStripe } = require('../config/stripe');
const AppError = require('../utils/AppError');

function activeProvider() {
  const configured = process.env.PAYMENT_PROVIDER || (getStripe() ? 'stripe' : 'mock');
  if (configured === 'mock' && process.env.NODE_ENV === 'production') {
    throw new AppError('Mock payments are disabled in production', 500);
  }
  return configured;
}

/** Creates a payment for an order; returns what the client needs to collect payment. */
async function createPayment({ order, customerEmail }) {
  const provider = activeProvider();

  if (provider === 'mock') {
    return { provider, paymentIntentId: `mock_${crypto.randomUUID()}`, clientSecret: null };
  }

  if (provider === 'stripe') {
    const stripe = getStripe();
    if (!stripe) throw new AppError('Stripe is not configured: set STRIPE_SECRET_KEY', 503);
    const intent = await stripe.paymentIntents.create(
      {
        amount: order.total,
        currency: order.currency,
        automatic_payment_methods: { enabled: true },
        receipt_email: customerEmail,
        metadata: { orderId: order._id.toString(), userId: order.user.toString() },
      },
      { idempotencyKey: `order_${order._id}` } // safe to retry without double-charging
    );
    return { provider, paymentIntentId: intent.id, clientSecret: intent.client_secret };
  }

  throw new AppError(`Unknown PAYMENT_PROVIDER "${provider}"`, 500);
}

/** Verifies the Stripe-Signature header and returns the event. Needs the RAW request body. */
function constructStripeEvent(rawBody, signature) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) throw new AppError('Stripe webhook is not configured', 503);
  try {
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    throw new AppError(`Webhook signature verification failed: ${err.message}`, 400);
  }
}

module.exports = { activeProvider, createPayment, constructStripeEvent };
