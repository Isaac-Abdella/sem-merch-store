/**
 * End-to-end API test: register → geofence → checkout (mock payment) → driver tracking.
 *
 * Database: by default an in-memory MongoDB is downloaded and started (mongodb-memory-server,
 * first run downloads ~100 MB). To use your own instead:
 *   MONGO_URI_TEST=mongodb://127.0.0.1:27017/merch-store-test npm run test:integration
 */
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../src/app');
const Product = require('../../src/models/Product');
const User = require('../../src/models/User');

const torontoAddress = { line1: '100 Queen St W', city: 'Toronto', province: 'ON', postalCode: 'M5H2N2' };
const barrieAddress = { line1: '70 Collier St', city: 'Barrie', province: 'ON', postalCode: 'L4M 4T5' };

describe('checkout and tracking flow', () => {
  let memoryServer;
  const customer = request.agent(app); // agents keep the auth cookie between requests
  const otherCustomer = request.agent(app);
  const driver = request.agent(app);
  const admin = request.agent(app);
  let hoodie;
  let orderId;

  before(async () => {
    let uri = process.env.MONGO_URI_TEST;
    if (!uri) {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri();
    }
    await mongoose.connect(uri);
    await mongoose.connection.dropDatabase();
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init())); // build unique indexes

    hoodie = await Product.create({ name: 'Test Hoodie', price: 5000, stock: 5 });
    await User.create({ name: 'Driver', email: 'driver@test.com', password: 'Driver123!', role: 'driver' });
    await User.create({ name: 'Admin', email: 'admin@test.com', password: 'Admin123!', role: 'admin' });
    await driver.post('/api/auth/login').send({ email: 'driver@test.com', password: 'Driver123!' }).expect(200);
    await admin.post('/api/auth/login').send({ email: 'admin@test.com', password: 'Admin123!' }).expect(200);
  });

  after(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (memoryServer) await memoryServer.stop();
  });

  test('health check', async () => {
    await request(app).get('/api/health').expect(200);
  });

  test('rejects registration outside the delivery radius', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Far Away', email: 'far@test.com', password: 'Password1!', address: barrieAddress })
      .expect(403);
    assert.equal(res.body.code, 'OUT_OF_SERVICE_AREA');
  });

  test('validates input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', email: 'not-an-email', password: 'short', address: { ...torontoAddress, postalCode: '12345' } })
      .expect(400);
    const paths = res.body.errors.map((e) => e.path);
    for (const p of ['email', 'password', 'address.postalCode']) assert.ok(paths.includes(p), `missing ${p}`);
  });

  test('registers a Toronto customer and sets an httpOnly cookie', async () => {
    const res = await customer
      .post('/api/auth/register')
      .send({ name: 'Casey', email: 'casey@test.com', password: 'Password1!', address: torontoAddress })
      .expect(201);
    assert.equal(res.body.user.password, undefined);
    assert.match(res.headers['set-cookie'][0], /HttpOnly/i);
    assert.equal(res.body.user.address.postalCode, 'M5H 2N2'); // normalised
    await customer.get('/api/auth/me').expect(200);
  });

  test('duplicate email returns 409', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Casey 2', email: 'casey@test.com', password: 'Password1!', address: torontoAddress })
      .expect(409);
  });

  test('wrong password returns 401', async () => {
    await request(app).post('/api/auth/login').send({ email: 'casey@test.com', password: 'nope-nope' }).expect(401);
  });

  test('checkout to an outside address is blocked', async () => {
    const res = await customer
      .post('/api/payments/create-intent')
      .send({ items: [{ productId: hoodie._id.toString(), quantity: 1 }], shippingAddress: barrieAddress })
      .expect(403);
    assert.equal(res.body.code, 'OUT_OF_SERVICE_AREA');
  });

  test('cannot buy more than the stock', async () => {
    await customer
      .post('/api/payments/create-intent')
      .send({ items: [{ productId: hoodie._id.toString(), quantity: 6 }], shippingAddress: torontoAddress })
      .expect(409);
  });

  test('creates an order priced from the database', async () => {
    const res = await customer
      .post('/api/payments/create-intent')
      // a "price" field from the client is ignored (zod strips unknown keys)
      .send({ items: [{ productId: hoodie._id.toString(), quantity: 2, price: 1 }], shippingAddress: torontoAddress })
      .expect(201);
    assert.equal(res.body.provider, 'mock');
    assert.equal(res.body.totals.subtotal, 10000);
    assert.equal(res.body.totals.total, 10000 + 1300); // free shipping + 13% HST
    orderId = res.body.orderId;
  });

  test('mock payment marks the order paid and decrements stock', async () => {
    const res = await customer.post(`/api/payments/mock/${orderId}/confirm`).expect(200);
    assert.equal(res.body.order.paymentStatus, 'paid');
    assert.equal(res.body.order.status, 'processing');
    assert.equal((await Product.findById(hoodie._id)).stock, 3);

    // Confirming twice is harmless (idempotent) — stock doesn't drop again
    await customer.post(`/api/payments/mock/${orderId}/confirm`).expect(200);
    assert.equal((await Product.findById(hoodie._id)).stock, 3);
  });

  test("other customers can't see the order", async () => {
    await otherCustomer
      .post('/api/auth/register')
      .send({ name: 'Other', email: 'other@test.com', password: 'Password1!', address: { ...torontoAddress, city: 'Markham' } })
      .expect(201);
    await otherCustomer.get(`/api/orders/${orderId}`).expect(404);
    await otherCustomer.get(`/api/tracking/${orderId}`).expect(404);
  });

  test('unassigned driver cannot post a location', async () => {
    await driver.post(`/api/tracking/${orderId}/location`).send({ lat: 43.66, lng: -79.39 }).expect(403);
  });

  test('admin assigns the driver; driver location shows up for the customer', async () => {
    await admin.patch(`/api/orders/${orderId}/assign-driver`).send({ driverEmail: 'driver@test.com' }).expect(200);

    const assigned = await driver.get('/api/tracking/driver/assigned').expect(200);
    assert.equal(assigned.body.deliveries.length, 1);

    const ping = await driver.post(`/api/tracking/${orderId}/location`).send({ lat: 43.66, lng: -79.39 }).expect(200);
    assert.equal(ping.body.status, 'out_for_delivery');

    const tracking = await customer.get(`/api/tracking/${orderId}`).expect(200);
    assert.deepEqual(tracking.body.shipment.currentLocation, { lat: 43.66, lng: -79.39 });
    assert.deepEqual(tracking.body.shipment.destination, { lat: 43.6534, lng: -79.3841 });
    assert.equal(tracking.body.order.status, 'out_for_delivery');
  });

  test('driver marks delivered; further pings are rejected', async () => {
    await driver.post(`/api/tracking/${orderId}/status`).send({ status: 'delivered' }).expect(200);
    await driver.post(`/api/tracking/${orderId}/location`).send({ lat: 43.65, lng: -79.38 }).expect(400);
  });

  test('customers cannot use admin routes', async () => {
    await customer.get('/api/orders').expect(403);
    await customer.post('/api/products').send({ name: 'Hack', price: 1 }).expect(403);
    await customer.delete(`/api/products/${hoodie._id}/permanent`).expect(403);
  });

  describe('products with options (size / weight / volume)', () => {
    let coffee;
    const option = (label) => coffee.variants.find((v) => v.label === label);

    test('admin validation: options need at least one entry and unique labels', async () => {
      await admin.post('/api/products').send({ name: 'No Options', optionType: 'weight', variants: [] }).expect(400);
      const dup = await admin
        .post('/api/products')
        .send({ name: 'Dup', optionType: 'size', variants: [{ label: 'M', price: 100 }, { label: 'm', price: 200 }] })
        .expect(400);
      assert.ok(dup.body.errors.some((e) => e.path === 'variants.1.label'));
      await admin.post('/api/products').send({ name: 'No Price' }).expect(400);
    });

    test('admin creates a product priced per option; price is the cheapest, stock the total', async () => {
      const res = await admin
        .post('/api/products')
        .send({
          name: 'Test Coffee',
          image: './images/coffee.jpg', // relative paths are made root-relative
          optionType: 'weight',
          variants: [
            { label: '250 g', price: 1500, stock: 4 },
            { label: '1 kg', price: 4500, stock: 1 },
          ],
        })
        .expect(201);
      coffee = res.body.product;
      assert.equal(coffee.price, 1500);
      assert.equal(coffee.stock, 5);
      assert.equal(coffee.image, '/images/coffee.jpg');
    });

    test('checkout requires a valid option and respects its stock', async () => {
      const buy = (item) =>
        customer.post('/api/payments/create-intent').send({ items: [{ productId: coffee._id, ...item }], shippingAddress: torontoAddress });
      await buy({ quantity: 1 }).expect(400); // no option chosen
      await buy({ quantity: 1, variantId: hoodie._id.toString() }).expect(400); // not one of this product's options
      await buy({ quantity: 2, variantId: option('1 kg')._id }).expect(409); // only 1 kg bag left
    });

    test('orders are priced per option and decrement that option', async () => {
      const res = await customer
        .post('/api/payments/create-intent')
        .send({
          items: [
            { productId: coffee._id, variantId: option('1 kg')._id, quantity: 1 },
            { productId: coffee._id, variantId: option('250 g')._id, quantity: 2 },
          ],
          shippingAddress: torontoAddress,
        })
        .expect(201);
      assert.equal(res.body.totals.subtotal, 4500 + 2 * 1500);

      const paid = await customer.post(`/api/payments/mock/${res.body.orderId}/confirm`).expect(200);
      const kg = paid.body.order.items.find((i) => i.optionLabel === '1 kg');
      assert.equal(kg.optionType, 'weight');
      assert.equal(kg.price, 4500);

      const after = await Product.findById(coffee._id);
      assert.deepEqual(after.variants.map((v) => [v.label, v.stock]), [['250 g', 2], ['1 kg', 0]]);
      assert.equal(after.stock, 2);
    });

    test('editing options keeps their ids so carts stay valid', async () => {
      const variants = coffee.variants.map((v) => ({ _id: v._id, label: v.label, price: v.price + 100, stock: 10 }));
      const res = await admin.patch(`/api/products/${coffee._id}`).send({ optionType: 'weight', variants }).expect(200);
      assert.deepEqual(res.body.product.variants.map((v) => v._id), coffee.variants.map((v) => v._id));
      assert.equal(res.body.product.price, 1600);
      assert.equal(res.body.product.stock, 20);
    });
  });

  test('admin permanently deletes a product; past orders keep their snapshot', async () => {
    await admin.delete(`/api/products/${hoodie._id}/permanent`).expect(200);
    assert.equal(await Product.findById(hoodie._id), null);
    await admin.delete(`/api/products/${hoodie._id}/permanent`).expect(404);

    const order = await customer.get(`/api/orders/${orderId}`).expect(200);
    assert.equal(order.body.order.items[0].name, 'Test Hoodie');
  });
});
