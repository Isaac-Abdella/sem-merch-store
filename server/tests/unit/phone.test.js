const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toE164, maskPhone } = require('../../src/utils/phone');

test('normalizes Canadian numbers to E.164', () => {
  assert.equal(toE164('(416) 555-0123'), '+14165550123');
  assert.equal(toE164('1-647-555-0199'), '+16475550199');
  assert.equal(toE164('+1 905 555 0100'), '+19055550100');
});

test('rejects invalid numbers', () => {
  assert.equal(toE164('555-0123'), null);
  assert.equal(toE164('011 416 555 0123'), null);
  assert.equal(toE164('116 555 0123'), null);
  assert.equal(toE164(''), null);
});

test('masks a phone for logs', () => {
  assert.equal(maskPhone('+14165550123'), '•••-•••-0123');
});
