const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { canViewOrder } = require('../utils/permissions');
const { emitTrackingUpdate } = require('../sockets/tracking');
const { fetchCarrierTracking } = require('../services/shippingService');
const { canadaPostConfig } = require('../config/canadaPost');

// GET /api/orders/mine
async function getMyOrders(req, res) {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ orders });
}

// GET /api/orders/:id
async function getOrderById(req, res) {
  const order = await Order.findById(req.params.id).populate('user', 'name email');
  const shipment = order && (await Shipment.findOne({ order: order._id }));
  if (!canViewOrder(req.user, order, shipment)) throw new AppError('Order not found', 404);
  res.json({ order });
}

// GET /api/orders?status=processing   (admin)
async function getAllOrders(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const orders = await Order.find(filter).populate('user', 'name email').sort({ createdAt: -1 }).limit(200);

  // Attach the assigned driver (if any) so the admin table can show it
  const shipments = await Shipment.find({ order: { $in: orders.map((o) => o._id) } }).populate('driver', 'name email');
  const byOrder = new Map(shipments.map((s) => [s.order.toString(), s]));
  res.json({
    orders: orders.map((o) => ({
      ...o.toJSON(),
      driver: byOrder.get(o._id.toString())?.driver || null,
      carrier: byOrder.get(o._id.toString())?.carrier || 'local',
      trackingNumber: byOrder.get(o._id.toString())?.trackingNumber || null,
    })),
  });
}

// PATCH /api/orders/:id/status   (admin)
async function updateOrderStatus(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  if (order.paymentStatus !== 'paid' && req.body.status !== 'cancelled') {
    throw new AppError('Only paid orders can move through fulfilment', 400);
  }
  order.setStatus(req.body.status, req.body.note);
  await order.save();
  emitTrackingUpdate(order._id, { status: order.status, note: req.body.note, at: new Date() });
  res.json({ order });
}

// PATCH /api/orders/:id/assign-driver   (admin)   Body: { driverEmail }
async function assignDriver(req, res) {
  const driver = await User.findOne({ email: req.body.driverEmail, role: 'driver' });
  if (!driver) throw new AppError('No driver account with that email', 404);
  const shipment = await Shipment.findOne({ order: req.params.id });
  if (!shipment) throw new AppError('This order has no shipment yet (is it paid?)', 400);
  shipment.driver = driver._id;
  await shipment.save();
  res.json({ shipment, driver: { _id: driver._id, name: driver.name, email: driver.email } });
}

// PATCH /api/orders/:id/carrier   (admin)   Body: { carrier: 'canada_post', trackingNumber }
// Hand an order to Canada Post: saves the PIN, marks it shipped (texts the customer) and checks tracking once.
async function setCarrierTracking(req, res) {
  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);
  const shipment = await Shipment.findOne({ order: order._id });
  if (!shipment) throw new AppError('This order has no shipment yet (is it paid?)', 400);

  shipment.carrier = req.body.carrier;
  shipment.trackingNumber = req.body.carrier === 'local' ? undefined : req.body.trackingNumber.toUpperCase();
  await shipment.save();

  if (shipment.carrier !== 'local' && order.status === 'processing') {
    order.setStatus('shipped', `Handed to Canada Post (${shipment.trackingNumber})`);
    await order.save();
    emitTrackingUpdate(order._id, { status: order.status, at: new Date() });
  }

  let tracking = null;
  if (shipment.carrier === 'canada_post' && canadaPostConfig().enabled) {
    tracking = await fetchCarrierTracking(shipment).catch((err) => ({ error: err.message }));
  }
  res.json({ shipment, order: { _id: order._id, status: order.status }, tracking });
}

module.exports = { getMyOrders, getOrderById, getAllOrders, updateOrderStatus, assignDriver, setCarrierTracking };
