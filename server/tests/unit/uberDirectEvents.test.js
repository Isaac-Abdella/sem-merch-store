const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mapUberStatus } = require('../../src/utils/uberDirectEvents');

test('maps Uber Direct statuses', () => {
  assert.deepEqual(mapUberStatus({ status: 'pending' }), { status: null, notice: null });
  assert.deepEqual(mapUberStatus({ status: 'pickup' }), { status: null, notice: null });
  assert.deepEqual(mapUberStatus({ status: 'pickup_complete' }), { status: 'out_for_delivery', notice: null });
  assert.deepEqual(mapUberStatus({ status: 'dropoff', courierImminent: true }), { status: 'out_for_delivery', notice: 'arriving' });
  assert.deepEqual(mapUberStatus({ status: 'delivered' }), { status: 'delivered', notice: null });
  assert.deepEqual(mapUberStatus({ status: 'canceled' }), { status: null, notice: 'courier_canceled' });
  assert.deepEqual(mapUberStatus({ status: 'returned' }), { status: null, notice: 'returning' });
});
