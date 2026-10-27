const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateTotals } = require('../../src/services/pricingService');

describe('calculateTotals', () => {
  test('adds flat shipping under the free-shipping threshold and 13% HST', () => {
    const t = calculateTotals([{ price: 2999, quantity: 1 }]);
    assert.equal(t.subtotal, 2999);
    assert.equal(t.shipping, 999);
    assert.equal(t.tax, Math.round((2999 + 999) * 0.13)); // 520
    assert.equal(t.total, 2999 + 999 + 520);
  });

  test('free shipping at $75+', () => {
    const t = calculateTotals([{ price: 5999, quantity: 2 }]);
    assert.equal(t.shipping, 0);
    assert.equal(t.total, 11998 + Math.round(11998 * 0.13));
  });

  test('empty cart totals zero', () => {
    const t = calculateTotals([]);
    assert.deepEqual([t.subtotal, t.shipping, t.tax, t.total], [0, 0, 0, 0]);
  });

  test('everything stays in integer cents', () => {
    const t = calculateTotals([{ price: 799, quantity: 3 }, { price: 1499, quantity: 1 }]);
    for (const v of Object.values(t)) if (typeof v === 'number') assert.ok(Number.isInteger(v));
  });
});
