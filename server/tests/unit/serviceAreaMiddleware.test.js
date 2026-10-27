const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { requireServiceArea } = require('../../src/middleware/serviceArea');

const run = async (address) => {
  const req = { body: { address } };
  let nextCalled = false;
  await requireServiceArea()(req, {}, () => {
    nextCalled = true;
  });
  return { req, nextCalled };
};

describe('requireServiceArea middleware', () => {
  test('lets a Toronto address through and sets req.geo', async () => {
    const { req, nextCalled } = await run({ line1: '100 Queen St W', city: 'Toronto', postalCode: 'M5H 2N2' });
    assert.equal(nextCalled, true);
    assert.equal(typeof req.geo.lat, 'number');
    assert.equal(req.geo.distanceKm, 0);
  });

  test('rejects a Barrie address with 403 OUT_OF_SERVICE_AREA', async () => {
    await assert.rejects(run({ line1: '70 Collier St', city: 'Barrie', postalCode: 'L4M 4T5' }), (err) => {
      assert.equal(err.statusCode, 403);
      assert.equal(err.extra.code, 'OUT_OF_SERVICE_AREA');
      return true;
    });
  });

  test('rejects an address the geocoder cannot find with 400', async () => {
    await assert.rejects(run({ line1: '1 Nowhere Rd', city: 'Atlantis', postalCode: 'A1A 1A1' }), (err) => {
      assert.equal(err.statusCode, 400);
      assert.equal(err.extra.code, 'ADDRESS_NOT_FOUND');
      return true;
    });
  });

  test('ignores coordinates sent by the client', async () => {
    const { req } = await run({ line1: '1 Main St', city: 'Mississauga', postalCode: 'L5B 1M2', location: { lat: 0, lng: 0 } });
    assert.ok(Math.abs(req.geo.lat - 43.589) < 0.01);
  });
});
