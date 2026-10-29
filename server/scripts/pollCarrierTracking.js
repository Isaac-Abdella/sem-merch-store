/**
 * One-shot Canada Post tracking check, for a Render Cron Job (or any scheduler):
 *   npm run poll:carriers --prefix server
 */
require('dotenv').config({ quiet: true });
const { connectDB } = require('../src/config/db');
const mongoose = require('mongoose');
const { pollCarrierShipmentsOnce } = require('../src/jobs/carrierTrackingPoller');

(async () => {
  await connectDB();
  const results = await pollCarrierShipmentsOnce();
  console.log('[carrier-poll]', results);
  await mongoose.disconnect();
})().catch((err) => {
  console.error('[carrier-poll] failed:', err);
  process.exit(1);
});
