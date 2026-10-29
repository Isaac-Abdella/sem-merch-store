/**
 * SMS opt-in at checkout + Canada Post tracking → text messages (mock SMS, stubbed Canada Post API).
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Product = require('../../src/models/Product');
const User = require('../../src/models/User');
const Shipment = require('../../src/models/Shipment');
const { sentInMock } = require('../../src/services/smsService');
const { fetchCarrierTracking } = require('../../src/services/shippingService');
const { _resetToken } = require('../../src/services/canadaPostClient');

const torontoAddress = { line1: '100 Queen St W', city: 'Toronto', province: 'ON', postalCode: 'M5H2N2' };
const settle = () => new Promise((r) => setTimeout(r, 50)); // post-save SMS hook is fire-and-forget

describe('SMS updates and Canada Post tracking', () => {
  let memoryServer;
  const customer = request.agent(app);
  const admin = request.agent(app);
  let product;
  let orderId;
  const realFetch = global.fetch;

  before(async () => {
    let uri = process.env.MONGO_URI_TEST;
    if (!uri) {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri();
    }
    await mongoose.connect(uri);
    await mongoose.connection.dropDatabase();
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));
    product = await Product.create({ name: 'SMS Tee', price: 2500, stock: 10 });
    await User.create({ name: 'Admin', email: 'admin-sms@test.com', password: 'Admin123!', role: 'admin' });
    await admin.post('/api/auth/login').send({ email: 'admin-sms@test.com', password: 'Admin123!' }).expect(200);
    await customer.post('/api/auth/register')
      .send({ name: 'Texter', email: 'texter@test.com', password: 'Password1!', address: torontoAddress }).expect(201);
  });

  after(async () => {
    global.fetch = realFetch;
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (memoryServer) await memoryServer.stop();
  });

  test('opting in requires a valid mobile number', async () => {
    const res = await customer.post('/api/payments/create-intent').send({
      items: [{ productId: product._id, quantity: 1 }], shippingAddress: torontoAddress,
      contact: { smsOptIn: true, phone: '555-0123' },
    }).expect(400);
    assert.match(JSON.stringify(res.body), /mobile number/);
  });

  test('checkout without opt-in sends no texts', async () => {
    const before = sentInMock.length;
    const res = await customer.post('/api/payments/create-intent')
      .send({ items: [{ productId: product._id, quantity: 1 }], shippingAddress: torontoAddress }).expect(201);
    await customer.post(`/api/payments/mock/${res.body.orderId}/confirm`).expect(200);
    await settle();
    assert.equal(sentInMock.length, before);
  });

  test('opted-in customer gets a text when payment goes through', async () => {
    const res = await customer.post('/api/payments/create-intent').send({
      items: [{ productId: product._id, quantity: 1 }], shippingAddress: torontoAddress,
      contact: { smsOptIn: true, phone: '(416) 555-0123' },
    }).expect(201);
    orderId = res.body.orderId;
    await customer.post(`/api/payments/mock/${orderId}/confirm`).expect(200);
    await customer.post(`/api/payments/mock/${orderId}/confirm`).expect(200); // idempotent: no 2nd text
    await settle();
    const texts = sentInMock.filter((m) => m.to === '+14165550123');
    assert.equal(texts.length, 1);
    assert.match(texts[0].body, /got your order/);
    assert.match(texts[0].body, /Reply STOP/);
  });

  test('admin attaches a Canada Post PIN → order shipped + text', async () => {
    const res = await admin.patch(`/api/orders/${orderId}/carrier`)
      .send({ carrier: 'canada_post', trackingNumber: '1234567890123456' }).expect(200);
    assert.equal(res.body.order.status, 'shipped');
    await settle();
    const last = sentInMock.at(-1);
    assert.match(last.body, /has shipped/);
    assert.match(last.body, /Tracking: 1234567890123456/);
  });

  test('customers cannot set carrier tracking', async () => {
    await customer.patch(`/api/orders/${orderId}/carrier`)
      .send({ carrier: 'canada_post', trackingNumber: '1234567890123456' }).expect(403);
  });

  test('Canada Post scans move the order forward and text the customer once per event', async () => {
    Object.assign(process.env, { CP_TOKEN_URL: 'https://cp.test/token', CP_API_KEY: 'k', CP_API_SECRET: 's' });
    _resetToken();
    let scan = { eventIdentifier: '174', eventType: 'OUT', eventDescription: 'Item out for delivery' };
    global.fetch = async (url) => ({
      ok: true, status: 200,
      json: async () => (String(url).includes('/token') ? { access_token: 't', expires_in: 3600 } : { trackingSummary: { pinSummary: [scan] } }),
    });

    const shipment = await Shipment.findOne({ order: orderId });
    let r = await fetchCarrierTracking(shipment);
    assert.equal(r.status, 'out_for_delivery');
    r = await fetchCarrierTracking(await Shipment.findOne({ order: orderId })); // same scan again
    assert.equal(r.changed, false);

    scan = { eventIdentifier: '1435', eventType: 'ATTEMPTED', eventDescription: 'Notice card left' };
    await fetchCarrierTracking(await Shipment.findOne({ order: orderId }));
    scan = { eventIdentifier: '1421', eventType: 'DELIVERED', eventDescription: 'Delivered' };
    r = await fetchCarrierTracking(await Shipment.findOne({ order: orderId }));
    assert.equal(r.status, 'delivered');
    await settle();

    const bodies = sentInMock.filter((m) => m.to === '+14165550123').map((m) => m.body);
    assert.equal(bodies.filter((b) => /out for delivery/.test(b)).length, 1);
    assert.equal(bodies.filter((b) => /tried to deliver/.test(b)).length, 1);
    assert.equal(bodies.filter((b) => /was delivered/.test(b)).length, 1);
    global.fetch = realFetch;
  });
});
