/**
 * POST /api/webhooks/stripe
 * Stripe calls this after a payment succeeds or fails. It is the SOURCE OF TRUTH for payment —
 * never mark an order paid just because the browser was redirected to the success page.
 *
 * Local testing:  stripe listen --forward-to localhost:5000/api/webhooks/stripe
 *                 then copy the printed whsec_... into STRIPE_WEBHOOK_SECRET.
 */
const { constructStripeEvent } = require('../services/paymentService');
const { markOrderPaid, markOrderFailed } = require('../services/orderService');
const { emitTrackingUpdate } = require('../sockets/tracking');
const uberDirect = require('../services/uberDirectService');

async function handleStripeWebhook(req, res) {
  // req.body is a Buffer here because this route uses express.raw()
  const event = constructStripeEvent(req.body, req.headers['stripe-signature']);

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object;
      const orderId = intent.metadata?.orderId;
      if (orderId) {
        const order = await markOrderPaid(orderId, { paymentIntentId: intent.id });
        if (order) emitTrackingUpdate(order._id, { status: order.status, at: new Date() });
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object;
      const reason = intent.last_payment_error?.message || 'Payment failed';
      if (intent.metadata?.orderId) await markOrderFailed(intent.metadata.orderId, reason);
      break;
    }
    default:
      // Other events (refunds, disputes, etc.) can be handled here as you need them.
      break;
  }

  // Respond quickly with 2xx, otherwise Stripe retries.
  res.json({ received: true });
}

/**
 * POST /api/webhooks/uber-direct
 * Add this URL in the Uber Direct dashboard → Developer → Webhooks (delivery status + courier update),
 * then copy the signing key into UBER_WEBHOOK_SIGNING_KEY.
 */
async function handleUberDirectWebhook(req, res) {
  if (!uberDirect.verifyWebhookSignature(req.body, req.headers)) {
    return res.status(401).json({ message: 'Invalid signature' });
  }
  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ message: 'Invalid JSON' });
  }
  try {
    await uberDirect.applyWebhookEvent(event);
  } catch (err) {
    console.error('Uber webhook:', err.message);
    return res.status(500).json({ message: 'Temporary error' }); // 5xx → Uber retries
  }
  res.json({ received: true });
}

module.exports = { handleUberDirectWebhook, handleStripeWebhook };
