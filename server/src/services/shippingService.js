const Shipment = require('../models/Shipment');
const serviceArea = require('../config/serviceArea');
const { toGeoJSONPoint } = require('./geoService');
const Order = require('../models/Order');
const { getTrackingSummary } = require('./canadaPostTrackingService');
const { mapCanadaPostEvent } = require('../utils/canadaPostEvents');
const { notifyNotice } = require('./notificationService');
const { emitTrackingUpdate } = require('../sockets/tracking');

// Forward-only progression, so an out-of-order scan never moves an order backwards
const STATUS_ORDER = ['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered'];

/** Called once an order is paid. Origin defaults to the service-area center (your warehouse). */
async function createShipmentForOrder(order, { carrier = 'local' } = {}) {
  const existing = await Shipment.findOne({ order: order._id });
  if (existing) return existing;
  return Shipment.create({
    order: order._id,
    carrier,
    origin: toGeoJSONPoint(serviceArea.center),
    destination: order.shippingAddress?.location,
  });
}

/**
 * Carrier tracking. Canada Post is implemented; add Purolator/UPS/FedEx the same way.
 * Reads the latest scan, moves the order forward if needed (which texts the customer via the
 * Order model hook) and texts extra notices like "delivery attempted" or "ready for pickup".
 * Scan locations are city-level, so we don't draw them on the live map.
 */
async function fetchCarrierTracking(shipment) {
  if (shipment.carrier === 'local') return null;
  if (shipment.carrier !== 'canada_post') {
    throw new Error(`Carrier tracking for "${shipment.carrier}" is not implemented yet`);
  }
  if (!shipment.trackingNumber) return null;

  const event = await getTrackingSummary(shipment.trackingNumber);
  if (!event.code || event.code === shipment.lastCarrierEvent?.code) return { changed: false, event };

  shipment.lastCarrierEvent = { ...event, checkedAt: new Date() };
  await shipment.save();

  const order = await Order.findById(shipment.order?._id || shipment.order);
  if (!order || ['delivered', 'cancelled'].includes(order.status)) return { changed: true, event };

  const { status, notice } = mapCanadaPostEvent(event);
  const rank = (s) => STATUS_ORDER.indexOf(s);
  if (status && rank(status) > rank(order.status)) {
    order.setStatus(status, `Canada Post: ${event.description || event.code}`);
    await order.save(); // → Order post-save hook → SMS
    emitTrackingUpdate(order._id, { status: order.status, note: event.description, at: new Date() });
  }
  if (notice) await notifyNotice(order, notice, { trackingNumber: shipment.trackingNumber });

  return { changed: true, event, status: order.status };
}

module.exports = { createShipmentForOrder, fetchCarrierTracking };
