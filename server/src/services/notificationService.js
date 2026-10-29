/**
 * Decides WHEN to text a customer and WHAT to say. Called automatically by the Order model
 * whenever order.status changes (local drivers, admin, Canada Post poller — all the same path).
 * Never throws: a failed text must not break checkout or a status update.
 */
const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const { sendSms } = require('./smsService');
const { smsConfig } = require('../config/sms');
const { maskPhone } = require('../utils/phone');

const STATUS_MESSAGES = {
  processing: (o, s) => `${s}: we got your order #${o.short} and payment. We'll text you when it ships.`,
  shipped: (o, s) => `${s}: order #${o.short} has shipped.${o.tracking}`,
  out_for_delivery: (o, s) => `${s}: order #${o.short} is out for delivery today.`,
  delivered: (o, s) => `${s}: order #${o.short} was delivered. Thanks for shopping with us!`,
  cancelled: (o, s) => `${s}: order #${o.short} was cancelled. Reply or contact us if this is a mistake.`,
};

const NOTICE_MESSAGES = {
  attempted: (o, s) => `${s}: Canada Post tried to deliver order #${o.short}. Check the notice card or tracking.${o.tracking}`,
  ready_for_pickup: (o, s) => `${s}: order #${o.short} is ready for pickup at your post office.${o.tracking}`,
  returning: (o, s) => `${s}: order #${o.short} is being returned to us. We'll contact you.`,
  arriving: (o, s) => `${s}: your courier is about a minute away with order #${o.short}.`,
  courier_canceled: (o, s) => `${s}: the courier for order #${o.short} cancelled. We're arranging a new one.`,
};

function context(order, { trackingNumber, trackingUrl } = {}) {
  const { clientUrl } = smsConfig();
  let tracking = ` Track it: ${clientUrl}/orders/${order._id}/track`;
  if (trackingUrl) tracking = ` Track it: ${trackingUrl}`;
  else if (trackingNumber) tracking = ` Tracking: ${trackingNumber}`;
  return { short: String(order._id).slice(-6).toUpperCase(), tracking };
}

/** key = a status ("shipped") or a notice ("notice:attempted"). Each key is texted at most once. */
async function notify(order, key, links = {}) {
  try {
    const contact = order.contact || {};
    if (!contact.smsOptIn || !contact.phone || contact.smsOptOutAt) return { skipped: 'no-consent' };
    if ((contact.smsSent || []).includes(key)) return { skipped: 'already-sent' };

    const isNotice = key.startsWith('notice:');
    const template = isNotice ? NOTICE_MESSAGES[key.slice(7)] : STATUS_MESSAGES[key];
    if (!template) return { skipped: 'no-template' };

    // Claim the key atomically first, so two processes can't send the same text twice.
    const claimed = await Order.updateOne(
      { _id: order._id, 'contact.smsSent': { $ne: key } },
      { $addToSet: { 'contact.smsSent': key } }
    );
    if (claimed.modifiedCount === 0) return { skipped: 'already-sent' };

    // Status texts come from the Order hook without links, so use the carrier's tracking link if there is one
    if (!links.trackingUrl && !links.trackingNumber) {
      const shipment = await Shipment.findOne({ order: order._id }).select('carrier trackingNumber trackingUrl').lean();
      if (shipment?.trackingUrl) links = { trackingUrl: shipment.trackingUrl };
      else if (shipment?.carrier === 'canada_post' && shipment.trackingNumber) links = { trackingNumber: shipment.trackingNumber };
    }
    const body = `${template(context(order, links), smsConfig().storeName)} Reply STOP to opt out.`;
    return await sendSms(contact.phone, body);
  } catch (err) {
    if (err.code === 21610) {
      await Order.updateOne({ _id: order._id }, { $set: { 'contact.smsOptOutAt': new Date() } }).catch(() => {});
    }
    console.error(`SMS for order ${order._id} (${key}) to ${maskPhone(order.contact?.phone)} failed: ${err.message}`);
    return { error: err.message };
  }
}

const notifyStatus = (order, opts) => notify(order, order.status, opts);
const notifyNotice = (order, notice, opts) => notify(order, `notice:${notice}`, opts);

module.exports = { notifyStatus, notifyNotice, STATUS_MESSAGES, NOTICE_MESSAGES };
