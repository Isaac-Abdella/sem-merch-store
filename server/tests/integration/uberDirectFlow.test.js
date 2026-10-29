/**
 * Uber Direct: admin dispatches a courier → signed webhooks move the order and text the customer.
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Product = require('../../src/models/Product');
const User = require('../../src/models/User');
const Shipment = require('../../src/models/Shipment');
const { sentInMock } = require('../../src/services/smsService');
const { _resetToken } = require('../../src/services/uberDirectClient');

const torontoAddress = { line1: '100 Queen St W', city: 'Toronto', province: 'ON', postalCode: 'M5H2N2' };
const PHONE = '+16475550142';
const settle = () => new Promise((r) => setTimeout(r, 50));
const SIGNING_KEY = 'test_signing_key';

function signed(agent, payload) {
  const body = JSON.stringify(payload);
  const sig = crypto.createHmac('sha256', SIGNING_KEY).update(body).digest('hex');
  return agent.post('/api/webhooks/uber-direct').set('Content-Type', 'application/json').set('x-uber-signature', sig).send(body);
}

describe('Uber Direct courier delivery', () => {
  let memoryServer;
  const customer = request.agent(app);
  const admin = request.agent(app);
  let product;
  let orderId;
  let deliveryId;
  const realFetch = global.fetch;

  before(async () => {
    Object.assign(process.env, {
      UBER_DIRECT_ENABLED: 'true', UBER_DIRECT_MODE: 'mock', UBER_WEBHOOK_SIGNING_KEY: SIGNING_KEY,
      UBER_PICKUP_PHONE: '+14165550100', UBER_PICKUP_LINE1: '1 Yonge St', UBER_PICKUP_POSTAL_CODE: 'M5E1E5',
    });
    let uri = process.env.MONGO_URI_TEST;
    if (!uri) {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri();
    }
    await mongoose.connect(uri);
    await mongoose.connection.dropDatabase();
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init()));
    product = await Product.create({ name: 'Uber Tee', price: 3000, stock: 10 });
    await User.create({ name: 'Admin', email: 'admin-uber@test.com', password: 'Admin123!', role: 'admin' });
    await admin.post('/api/auth/login').send({ email: 'admin-uber@test.com', password: 'Admin123!' }).expect(200);
    await customer.post('/api/auth/register')
      .send({ name: 'Rider', email: 'rider@test.com', password: 'Password1!', address: torontoAddress }).expect(201);
  });

  after(async () => {
    global.fetch = realFetch;
    process.env.UBER_DIRECT_ENABLED = 'false';
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (memoryServer) await memoryServer.stop();
  });

  test('dispatch needs a customer phone number', async () => {
    const res = await customer.post('/api/payments/create-intent')
      .send({ items: [{ productId: product._id, quantity: 1 }], shippingAddress: torontoAddress }).expect(201);
    await customer.post(`/api/payments/mock/${res.body.orderId}/confirm`).expect(200);
    const r = await admin.post(`/api/orders/${res.body.orderId}/uber-direct`).expect(400);
    assert.match(r.body.message, /phone number/);
  });

  test('admin requests an Uber courier → shipped + text with Uber tracking link', async () => {
    const res = await customer.post('/api/payments/create-intent').send({
      items: [{ productId: product._id, quantity: 2 }], shippingAddress: torontoAddress,
      contact: { smsOptIn: true, phone: '647-555-0142' },
    }).expect(201);
    orderId = res.body.orderId;
    await customer.post(`/api/payments/mock/${orderId}/confirm`).expect(200);

    const r = await admin.post(`/api/orders/${orderId}/uber-direct`).expect(201);
    assert.equal(r.body.order.status, 'shipped');
    assert.match(r.body.delivery.id, /^del_/);
    deliveryId = r.body.delivery.id;
    await settle();
    const last = sentInMock.filter((m) => m.to === PHONE).at(-1);
    assert.match(last.body, /has shipped/);
    assert.match(last.body, /ubereats\.com\/orders\/del_/);

    // Dispatching twice doesn't create a second courier
    const again = await admin.post(`/api/orders/${orderId}/uber-direct`).expect(200);
    assert.equal(again.body.alreadyDispatched, true);
    assert.equal(again.body.delivery.id, deliveryId);
  });

  test('rejects webhooks with a bad signature', async () => {
    await admin.post('/api/webhooks/uber-direct').set('Content-Type', 'application/json')
      .set('x-uber-signature', 'nope').send(JSON.stringify({ kind: 'event.delivery_status' })).expect(401);
  });

  test('courier GPS updates the live map', async () => {
    await signed(admin, { kind: 'event.courier_update', delivery_id: deliveryId, data: { courier: { location: { lat: 43.65, lng: -79.38 } } } }).expect(200);
    const shipment = await Shipment.findOne({ order: orderId });
    assert.deepEqual(shipment.currentLocation.coordinates, [-79.38, 43.65]);
  });

  test('status webhooks move the order forward and text once each', async () => {
    const ev = (status, extra = {}) => ({ kind: 'event.delivery_status', delivery_id: deliveryId, status, data: { id: deliveryId, status, ...extra } });
    await signed(admin, ev('pickup')).expect(200);
    await signed(admin, ev('pickup_complete')).expect(200);
    await signed(admin, ev('dropoff', { courier_imminent: true })).expect(200);
    await signed(admin, ev('dropoff', { courier_imminent: true })).expect(200); // Uber retries / repeats
    await signed(admin, ev('delivered')).expect(200);
    await settle();

    const order = await customer.get(`/api/orders/${orderId}`).expect(200);
    assert.equal((order.body.order || order.body).status, 'delivered');
    const bodies = sentInMock.filter((m) => m.to === PHONE).map((m) => m.body);
    assert.equal(bodies.filter((b) => /out for delivery/.test(b)).length, 1);
    assert.equal(bodies.filter((b) => /minute away/.test(b)).length, 1);
    assert.equal(bodies.filter((b) => /was delivered/.test(b)).length, 1);
  });

  test('live mode sends a quote then a delivery request to Uber', async () => {
    const res = await customer.post('/api/payments/create-intent').send({
      items: [{ productId: product._id, quantity: 1 }], shippingAddress: torontoAddress,
      contact: { smsOptIn: false, phone: '647-555-0142' },
    }).expect(201);
    await customer.post(`/api/payments/mock/${res.body.orderId}/confirm`).expect(200);

    Object.assign(process.env, { UBER_DIRECT_MODE: 'live', UBER_CLIENT_ID: 'id', UBER_CLIENT_SECRET: 'secret', UBER_CUSTOMER_ID: 'cust_1' });
    _resetToken();
    const calls = [];
    global.fetch = async (url, opts = {}) => {
      if (String(url).startsWith('http://127.0.0.1')) return realFetch(url, opts);
      calls.push({ url: String(url), body: opts.body });
      const json = String(url).includes('oauth') ? { access_token: 'tok', expires_in: 2592000 }
        : String(url).endsWith('/delivery_quotes') ? { id: 'dqt_live1', fee: 899, currency: 'cad' }
        : { id: 'del_live1', status: 'pending', fee: 899, tracking_url: 'https://www.ubereats.com/orders/del_live1' };
      return { ok: true, status: 200, json: async () => json };
    };
    const r = await admin.post(`/api/orders/${res.body.orderId}/uber-direct`).expect(201);
    global.fetch = realFetch;
    process.env.UBER_DIRECT_MODE = 'mock';

    assert.equal(r.body.delivery.id, 'del_live1');
    assert.match(calls[0].url, /auth\.uber\.com\/oauth\/v2\/token/);
    assert.match(calls[1].url, /\/customers\/cust_1\/delivery_quotes$/);
    assert.match(calls[2].url, /\/customers\/cust_1\/deliveries$/);
    const delivery = JSON.parse(calls[2].body);
    assert.equal(delivery.quote_id, 'dqt_live1');
    assert.equal(delivery.dropoff_phone_number, PHONE);
    assert.equal(delivery.manifest_items[0].quantity, 1);
    assert.equal(JSON.parse(delivery.dropoff_address).country, 'CA');
  });
});
