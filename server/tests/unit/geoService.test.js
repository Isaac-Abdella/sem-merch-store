const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { distanceKm, checkServiceArea, toGeoJSONPoint, fromGeoJSONPoint } = require('../../src/services/geoService');
const { MOCK_PLACES } = require('../../src/services/geocodeService');
const serviceArea = require('../../src/config/serviceArea');

const at = (name) => ({ lat: MOCK_PLACES[name][0], lng: MOCK_PLACES[name][1] });

describe('geoService', () => {
  test('default radius is 25 km', () => {
    assert.equal(serviceArea.radiusKm, 25);
  });

  test('distance from a point to itself is 0', () => {
    assert.equal(distanceKm(serviceArea.center, serviceArea.center), 0);
  });

  test('Toronto → Ottawa is roughly 350 km', () => {
    const d = distanceKm(at('toronto'), at('ottawa'));
    assert.ok(d > 340 && d < 360, `got ${d}`);
  });

  for (const city of ['toronto', 'north york', 'etobicoke', 'scarborough', 'mississauga', 'markham']) {
    test(`${city} is inside`, () => {
      assert.equal(checkServiceArea(at(city)).inside, true);
    });
  }

  for (const city of ['richmond hill', 'brampton', 'hamilton', 'oshawa', 'barrie', 'ottawa']) {
    test(`${city} is outside`, () => {
      const result = checkServiceArea(at(city));
      assert.equal(result.inside, false);
      assert.ok(result.distanceKm > serviceArea.radiusKm);
    });
  }

  test('GeoJSON conversion keeps [lng, lat] order', () => {
    const p = toGeoJSONPoint({ lat: 43.65, lng: -79.38 });
    assert.deepEqual(p, { type: 'Point', coordinates: [-79.38, 43.65] });
    assert.deepEqual(fromGeoJSONPoint(p), { lat: 43.65, lng: -79.38 });
  });
});
