const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mapCanadaPostEvent } = require('../../src/utils/canadaPostEvents');
const { parseSummary } = require('../../src/services/canadaPostTrackingService');

test('maps Canada Post scan events to order statuses', () => {
  assert.deepEqual(mapCanadaPostEvent({ code: '1301', type: 'INDUCTION' }), { status: 'shipped', notice: null });
  assert.deepEqual(mapCanadaPostEvent({ code: '3000', type: 'INDUCTION' }), { status: null, notice: null });
  assert.deepEqual(mapCanadaPostEvent({ code: '174', type: 'OUT' }), { status: 'out_for_delivery', notice: null });
  assert.deepEqual(mapCanadaPostEvent({ code: '1421', type: 'DELIVERED' }), { status: 'delivered', notice: null });
  assert.deepEqual(mapCanadaPostEvent({ code: '1435', type: 'ATTEMPTED' }), { status: null, notice: 'attempted' });
  assert.deepEqual(mapCanadaPostEvent({ code: '1701', type: 'TO_RETAIL' }), { status: null, notice: 'ready_for_pickup' });
  assert.deepEqual(mapCanadaPostEvent({ code: '1417', type: 'ATTEMPTED' }), { status: null, notice: 'returning' });
  assert.deepEqual(mapCanadaPostEvent({ code: '100', type: 'INFO' }), { status: null, notice: null });
});

test('parses camelCase and kebab-case tracking summaries', () => {
  const camel = parseSummary({ trackingSummary: { pinSummary: [{ eventIdentifier: '1421', eventType: 'DELIVERED', eventDescription: 'Delivered' }] } });
  assert.equal(camel.code, '1421');
  assert.equal(camel.type, 'DELIVERED');
  const kebab = parseSummary({ 'tracking-summary': { 'pin-summary': { 'event-identifier': '174', 'event-type': 'OUT' } } });
  assert.equal(kebab.code, '174');
  assert.equal(kebab.type, 'OUT');
});
