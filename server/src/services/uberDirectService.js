/**
 * Uber Direct: quote + dispatch a courier for a paid order, apply webhook updates, cancel.
 * Status changes go through order.setStatus() + save(), so opted-in customers get texts automatically.
 * Courier GPS (event.courier_update) is drawn on the existing live tracking map.
 */
const crypto = require('crypto');
const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const AppError = require('../utils/AppError');
const { uberDirectConfig } = require('../config/uberDirect');
const { uberRequest } = require('./uberDirectClient');
const { mapUberStatus } = require('../utils/uberDirectEvents');
const { notifyNotice } = require('./notificationService');
const { emitTrackingUpdate } = require('../sockets/tracking');
const { fromGeoJSONPoint } = require('./geoService');

const STATUS_ORDER = ['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered'];

const addressJson = (a) =>
  JSON.stringify({
    street_address: [a.line1, a.line2 || ''],
    city: a.city,
    state: a.province || 'ON',
    zip_code: a.postalCode,
    country: 'CA',
  });

function buildPayload(order, cfg) {
  const drop = fromGeoJSONPoint(order.shippingAddress?.location);
  const name = order.user?.name || 'Customer';
  const phone = order.contact?.phone;
  if (!phone) throw new AppError('Uber needs the customer\'s phone number for the courier. Add it to the order first.', 400);
  if (!cfg.pickup.phone || !cfg.pickup.line1 || !cfg.pickup.postalCode) {
    throw new AppError('Set UBER_PICKUP_PHONE, UBER_PICKUP_LINE1 and UBER_PICKUP_POSTAL_CODE (your store address)', 500);
  }
  return {
    quote: {
      pickup_address: addressJson(cfg.pickup),
      pickup_latitude: cfg.pickup.lat,
      pickup_longitude: cfg.pickup.lng,
      pickup_phone_number: cfg.pickup.phone,
      dropoff_address: addressJson(order.shippingAddress),
      dropoff_latitude: drop?.lat,
      dropoff_longitude: drop?.lng,
      dropoff_phone_number: phone,
      manifest_total_value: order.subtotal, // cents
      external_store_id: 'main',
    },
    delivery: {
      pickup_name: cfg.pickup.name,
      pickup_notes: cfg.pickup.notes,
      dropoff_name: name,
      dropoff_notes: order.shippingAddress?.line2 || '',
      manifest_reference: String(order._id),
      external_id: String(order._id),
      undeliverable_action: 'return',
      manifest_items: order.items.map((i) => ({
        name: i.optionLabel ? `${i.name} (${i.optionLabel})` : i.name,
        quantity: i.quantity,
        price: i.price,
        size: 'small',
        weight: cfg.defaultItem.weight,
        dimensions: { length: cfg.defaultItem.length, height: cfg.defaultItem.height, depth: cfg.defaultItem.depth },
      })),
    },
  };
}

// Mock mode: realistic-looking responses without calling Uber
function mockQuote() {
  return { id: `dqt_mock${crypto.randomBytes(6).toString('hex')}`, fee: 799, currency: 'cad', duration: 45 };
}
function mockDelivery(quoteId) {
  const id = `del_mock${crypto.randomBytes(6).toString('hex')}`;
  return { id, quote_id: quoteId, status: 'pending', fee: 799, currency: 'cad', tracking_url: `https://www.ubereats.com/orders/${id}`, live_mode: false };
}

async function getQuote(order) {
  const cfg = uberDirectConfig();
  const { quote } = buildPayload(order, cfg);
  return cfg.mode === 'mock' ? mockQuote() : uberRequest('POST', '/delivery_quotes', quote);
}

/** Quote + create the Uber delivery for a paid order. Idempotent: returns the existing one if already dispatched. */
async function dispatchOrder(orderId) {
  const cfg = uberDirectConfig();
  if (!cfg.enabled) throw new AppError('Uber Direct is turned off (UBER_DIRECT_ENABLED=false)', 400);

  const order = await Order.findById(orderId).populate('user', 'name');
  if (!order) throw new AppError('Order not found', 404);
  if (order.paymentStatus !== 'paid') throw new AppError('Only paid orders can be dispatched', 400);
  if (['delivered', 'cancelled'].includes(order.status)) throw new AppError(`Order is already ${order.status}`, 400);

  const shipment = await Shipment.findOne({ order: order._id });
  if (!shipment) throw new AppError('This order has no shipment yet', 400);
  if (shipment.carrier === 'uber_direct' && shipment.trackingNumber && !['canceled', 'returned'].includes(shipment.carrierStatus)) {
    return { shipment, order, alreadyDispatched: true };
  }

  const { quote, delivery } = buildPayload(order, cfg);
  const q = cfg.mode === 'mock' ? mockQuote() : await uberRequest('POST', '/delivery_quotes', quote);
  const d = cfg.mode === 'mock' ? mockDelivery(q.id) : await uberRequest('POST', '/deliveries', { ...quote, ...delivery, quote_id: q.id });

  shipment.carrier = 'uber_direct';
  shipment.trackingNumber = d.id;
  shipment.trackingUrl = d.tracking_url;
  shipment.carrierStatus = d.status;
  shipment.carrierFee = d.fee;
  await shipment.save();

  if (order.status === 'processing') {
    order.setStatus('shipped', 'Uber courier requested');
    await order.save(); // → SMS "has shipped" with the Uber tracking link
    emitTrackingUpdate(order._id, { status: order.status, at: new Date() });
  }
  return { shipment, order, quote: q };
}

async function cancelDelivery(orderId) {
  const shipment = await Shipment.findOne({ order: orderId, carrier: 'uber_direct' });
  if (!shipment?.trackingNumber) throw new AppError('No Uber delivery for this order', 404);
  if (uberDirectConfig().mode !== 'mock') {
    await uberRequest('POST', `/deliveries/${encodeURIComponent(shipment.trackingNumber)}/cancel`);
  }
  shipment.carrierStatus = 'canceled';
  await shipment.save();
  return shipment;
}

/** Verify Uber's webhook signature: HMAC-SHA256 of the raw body with your signing key. */
function verifyWebhookSignature(rawBody, headers) {
  const key = uberDirectConfig().webhookSigningKey;
  const given = headers['x-uber-signature'] || headers['x-postmates-signature'];
  if (!key || !given) return false;
  const expected = crypto.createHmac('sha256', key).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(given));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Apply an event.delivery_status / event.courier_update webhook. */
async function applyWebhookEvent(event) {
  const data = event.data || {};
  const deliveryId = event.delivery_id || data.id;
  if (!deliveryId) return { ignored: 'no delivery id' };

  // Return legs have ids starting with ret_; the original del_ is in related_deliveries
  const shipment = await Shipment.findOne({ carrier: 'uber_direct', trackingNumber: deliveryId });
  if (!shipment) return { ignored: 'unknown delivery' };
  const order = await Order.findById(shipment.order);
  if (!order) return { ignored: 'unknown order' };

  // Courier GPS → live map
  const loc = data.courier?.location || event.location;
  if (loc?.lat && loc?.lng) {
    shipment.recordLocation({ lat: loc.lat, lng: loc.lng });
    emitTrackingUpdate(order._id, { status: order.status, location: { lat: loc.lat, lng: loc.lng }, at: shipment.lastLocationAt });
  }

  const status = event.status || data.status;
  if (data.tracking_url) shipment.trackingUrl = data.tracking_url;
  if (status) shipment.carrierStatus = status;
  await shipment.save();

  if (event.kind !== 'event.delivery_status' || ['delivered', 'cancelled'].includes(order.status)) {
    return { ok: true };
  }

  const mapped = mapUberStatus({ status, courierImminent: data.courier_imminent });
  const rank = (s) => STATUS_ORDER.indexOf(s);
  if (mapped.status && rank(mapped.status) > rank(order.status)) {
    order.setStatus(mapped.status, `Uber: ${status.replace('_', ' ')}`);
    await order.save(); // → SMS
    emitTrackingUpdate(order._id, { status: order.status, at: new Date() });
  }
  if (mapped.notice) await notifyNotice(order, mapped.notice, { trackingUrl: shipment.trackingUrl });
  return { ok: true, status: order.status };
}

module.exports = { getQuote, dispatchOrder, cancelDelivery, verifyWebhookSignature, applyWebhookEvent, buildPayload };
