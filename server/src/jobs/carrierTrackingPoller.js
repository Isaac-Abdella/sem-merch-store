/**
 * Checks Canada Post for every undelivered carrier shipment and moves orders forward.
 * Status changes trigger SMS automatically (see Order model hooks → notificationService).
 *
 * Two ways to run it:
 *  - In-process: CARRIER_POLL_MINUTES=30 (fine locally / on paid always-on instances)
 *  - One-shot:   npm run poll:carriers --prefix server (Render Cron Job; free web services sleep)
 */
const Shipment = require('../models/Shipment');
const { fetchCarrierTracking } = require('../services/shippingService');
const { canadaPostConfig } = require('../config/canadaPost');

async function pollCarrierShipmentsOnce() {
  const shipments = await Shipment.find({ carrier: 'canada_post', trackingNumber: { $nin: [null, ''] } })
    .populate({ path: 'order', match: { status: { $in: ['processing', 'shipped', 'out_for_delivery'] } } });

  const results = { checked: 0, updated: 0, errors: 0 };
  for (const shipment of shipments.filter((s) => s.order)) {
    results.checked += 1;
    try {
      const r = await fetchCarrierTracking(shipment);
      if (r?.changed) results.updated += 1;
    } catch (err) {
      results.errors += 1;
      console.error(`Tracking ${shipment.trackingNumber}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 250)); // stay well under API rate limits
  }
  return results;
}

let timer = null;
function startCarrierTrackingPoller() {
  const { enabled, pollMinutes } = canadaPostConfig();
  if (!enabled || !pollMinutes || process.env.NODE_ENV === 'test') return null;
  const run = () => pollCarrierShipmentsOnce()
    .then((r) => r.checked && console.log('[carrier-poll]', r))
    .catch((e) => console.error('[carrier-poll] failed:', e.message));
  timer = setInterval(run, pollMinutes * 60 * 1000);
  timer.unref();
  run();
  console.log(`Canada Post tracking poller: every ${pollMinutes} min`);
  return timer;
}

const stopCarrierTrackingPoller = () => timer && clearInterval(timer);

module.exports = { pollCarrierShipmentsOnce, startCarrierTrackingPoller, stopCarrierTrackingPoller };
