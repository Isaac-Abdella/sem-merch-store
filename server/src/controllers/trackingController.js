const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const AppError = require('../utils/AppError');
const { canViewOrder, canDriveShipment } = require('../utils/permissions');
const { fromGeoJSONPoint } = require('../services/geoService');
const { emitTrackingUpdate } = require('../sockets/tracking');

function serializeShipment(shipment) {
  if (!shipment) return null;
  return {
    carrier: shipment.carrier,
    trackingNumber: shipment.trackingNumber,
    trackingUrl: shipment.trackingUrl,
    driver: shipment.driver?.name ? { name: shipment.driver.name } : null,
    origin: fromGeoJSONPoint(shipment.origin),
    destination: fromGeoJSONPoint(shipment.destination),
    currentLocation: fromGeoJSONPoint(shipment.currentLocation),
    lastLocationAt: shipment.lastLocationAt,
    path: shipment.path.map(({ lat, lng, at }) => ({ lat, lng, at })),
  };
}

// GET /api/tracking/:orderId
async function getTracking(req, res) {
  const order = await Order.findById(req.params.orderId);
  const shipment = order && (await Shipment.findOne({ order: order._id }).populate('driver', 'name'));
  if (!canViewOrder(req.user, order, shipment)) throw new AppError('Order not found', 404);

  res.json({
    order: {
      _id: order._id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      statusHistory: order.statusHistory,
      shippingAddress: { ...order.shippingAddress?.toObject(), location: fromGeoJSONPoint(order.shippingAddress?.location) },
      total: order.total,
      createdAt: order.createdAt,
    },
    shipment: serializeShipment(shipment),
  });
}

// POST /api/tracking/:orderId/location   (assigned driver or admin)   Body: { lat, lng }
async function postLocation(req, res) {
  const order = await Order.findById(req.params.orderId);
  const shipment = order && (await Shipment.findOne({ order: order._id }));
  if (!shipment) throw new AppError('Shipment not found', 404);
  if (!canDriveShipment(req.user, shipment)) throw new AppError('You are not assigned to this delivery', 403);
  if (['delivered', 'cancelled'].includes(order.status)) throw new AppError(`Order is already ${order.status}`, 400);

  shipment.recordLocation(req.body);
  await shipment.save();

  // First location ping automatically moves the order to "out for delivery"
  if (['processing', 'shipped'].includes(order.status)) {
    order.setStatus('out_for_delivery', 'Driver is on the way');
    await order.save();
  }

  const payload = { status: order.status, location: req.body, at: shipment.lastLocationAt };
  emitTrackingUpdate(order._id, payload);
  res.json(payload);
}

// POST /api/tracking/:orderId/status   (assigned driver or admin)   Body: { status, note? }
async function updateDeliveryStatus(req, res) {
  const order = await Order.findById(req.params.orderId);
  const shipment = order && (await Shipment.findOne({ order: order._id }));
  if (!shipment) throw new AppError('Shipment not found', 404);
  if (!canDriveShipment(req.user, shipment)) throw new AppError('You are not assigned to this delivery', 403);

  order.setStatus(req.body.status, req.body.note);
  await order.save();
  emitTrackingUpdate(order._id, { status: order.status, note: req.body.note, at: new Date() });
  res.json({ status: order.status });
}

// GET /api/tracking/driver/assigned   (driver) — deliveries assigned to me that aren't finished
async function getAssignedDeliveries(req, res) {
  const filter = req.user.role === 'admin' ? {} : { driver: req.user._id };
  const shipments = await Shipment.find(filter).populate({
    path: 'order',
    match: { status: { $in: ['processing', 'shipped', 'out_for_delivery'] } },
    populate: { path: 'user', select: 'name' },
  });

  res.json({
    deliveries: shipments
      .filter((s) => s.order)
      .map((s) => ({
        orderId: s.order._id,
        status: s.order.status,
        customer: s.order.user?.name,
        address: s.order.shippingAddress,
        ...serializeShipment(s),
      })),
  });
}

module.exports = { getTracking, postLocation, updateDeliveryStatus, getAssignedDeliveries };
