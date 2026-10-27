/**
 * Order fulfilment logic shared by the Stripe webhook and the mock payment flow.
 * Idempotent: Stripe can deliver the same webhook more than once.
 */
const Order = require('../models/Order');
const Product = require('../models/Product');
const { createShipmentForOrder } = require('./shippingService');

async function markOrderPaid(orderId, { paymentIntentId } = {}) {
  // Atomic "pending → paid" flip so concurrent webhook deliveries can't double-process.
  const order = await Order.findOneAndUpdate(
    { _id: orderId, paymentStatus: { $ne: 'paid' } },
    { $set: { paymentStatus: 'paid', paidAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!order) return Order.findById(orderId); // already processed

  if (paymentIntentId && order.paymentIntentId && order.paymentIntentId !== paymentIntentId) {
    console.warn(`Order ${orderId}: payment intent mismatch (${paymentIntentId})`);
  }

  // Decrement stock. A failure here means an oversell — flag it for manual review.
  for (const item of order.items) {
    // For an option, decrement both the option's stock and the product's total.
    const res = item.variant
      ? await Product.updateOne(
          { _id: item.product, variants: { $elemMatch: { _id: item.variant, stock: { $gte: item.quantity } } } },
          { $inc: { 'variants.$.stock': -item.quantity, stock: -item.quantity } }
        )
      : await Product.updateOne(
          { _id: item.product, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } }
        );
    if (res.modifiedCount === 0) console.warn(`Order ${orderId}: insufficient stock for ${item.name}`);
  }

  order.setStatus('processing', 'Payment received');
  await order.save();
  await createShipmentForOrder(order);
  return order;
}

async function markOrderFailed(orderId, reason = 'Payment failed') {
  const order = await Order.findById(orderId);
  if (!order || order.paymentStatus === 'paid') return order;
  order.paymentStatus = 'failed';
  order.statusHistory.push({ status: order.status, note: reason });
  await order.save();
  return order;
}

module.exports = { markOrderPaid, markOrderFailed };
