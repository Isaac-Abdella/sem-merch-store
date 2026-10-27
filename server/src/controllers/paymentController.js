const Order = require('../models/Order');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const { calculateTotals } = require('../services/pricingService');
const { toGeoJSONPoint } = require('../services/geoService');
const paymentService = require('../services/paymentService');
const { markOrderPaid } = require('../services/orderService');
const { emitTrackingUpdate } = require('../sockets/tracking');

/**
 * POST /api/payments/create-intent
 * Body: { items: [{ productId, quantity, variantId? }], shippingAddress }
 * The shipping address has already been geocoded and approved by requireServiceArea.
 * Prices ALWAYS come from the database — the client only says what and how many.
 */
async function createPaymentIntent(req, res) {
  const { items, shippingAddress } = req.body;

  const ids = [...new Set(items.map((i) => i.productId))];
  const products = await Product.find({ _id: { $in: ids }, active: true });
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  const lines = items.map((item) => {
    const product = byId.get(item.productId);
    if (!product) throw new AppError('One of the items in your cart is no longer available', 400);

    // Products with options are priced and stocked per option; others use the product itself.
    let variant = null;
    if (product.variants.length) {
      variant = item.variantId && product.variants.id(item.variantId);
      if (!variant) {
        throw new AppError(`Please choose a ${product.optionType} for "${product.name}"`, 400, { productId: item.productId });
      }
    }
    const { price, stock } = variant || product;
    const displayName = variant ? `${product.name} (${variant.label})` : product.name;
    if (stock < item.quantity) {
      throw new AppError(`Only ${stock} left of "${displayName}"`, 409, { productId: item.productId });
    }
    return {
      product: product._id,
      name: product.name,
      price,
      quantity: item.quantity,
      ...(variant && { variant: variant._id, optionType: product.optionType, optionLabel: variant.label }),
    };
  });

  const totals = calculateTotals(lines);

  const order = await Order.create({
    user: req.user._id,
    items: lines,
    ...totals,
    shippingAddress: { ...shippingAddress, location: toGeoJSONPoint(req.geo) },
    distanceKm: req.geo.distanceKm,
    statusHistory: [{ status: 'pending', note: 'Order created, awaiting payment' }],
  });

  const payment = await paymentService.createPayment({ order, customerEmail: req.user.email });
  order.paymentProvider = payment.provider;
  order.paymentIntentId = payment.paymentIntentId;
  await order.save();

  res.status(201).json({
    orderId: order._id,
    provider: payment.provider,
    clientSecret: payment.clientSecret, // null for the mock provider
    totals,
  });
}

/**
 * POST /api/payments/mock/:orderId/confirm   (dev only)
 * Simulates what the Stripe webhook does, so you can test the whole flow without keys.
 */
async function confirmMockPayment(req, res) {
  if (process.env.NODE_ENV === 'production') throw new AppError('Not available', 404);
  const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id });
  if (!order) throw new AppError('Order not found', 404);
  if (order.paymentProvider !== 'mock') throw new AppError('This order is not using mock payments', 400);

  const paid = await markOrderPaid(order._id, { paymentIntentId: order.paymentIntentId });
  emitTrackingUpdate(paid._id, { status: paid.status, at: new Date() });
  res.json({ order: paid });
}

// GET /api/payments/config — lets the client know which checkout UI to show
function getPaymentConfig(_req, res) {
  let provider;
  try {
    provider = paymentService.activeProvider();
  } catch {
    provider = 'unavailable';
  }
  res.json({ provider });
}

module.exports = { createPaymentIntent, confirmMockPayment, getPaymentConfig };
