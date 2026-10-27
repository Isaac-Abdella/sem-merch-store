const Shipment = require('../models/Shipment');
const serviceArea = require('../config/serviceArea');
const { toGeoJSONPoint } = require('./geoService');

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
 * Placeholder for carrier tracking (Canada Post, Purolator, UPS...).
 * Typical approach: call the carrier API (or an aggregator such as EasyPost/Shippo) on a schedule
 * or via their webhooks, then map each scan event to { lat, lng, status, at } and call
 * shipment.recordLocation(). Scan locations are usually city-level, not live GPS.
 */
async function fetchCarrierTracking(shipment) {
  if (shipment.carrier === 'local') return null;
  throw new Error(`Carrier tracking for "${shipment.carrier}" is not implemented yet`);
}

module.exports = { createShipmentForOrder, fetchCarrierTracking };
