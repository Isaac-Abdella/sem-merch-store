const mongoose = require('mongoose');
const { addressSchema } = require('./schemas');

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String, // snapshot at time of purchase
    price: Number, // cents, snapshot from the DB — never from the client
    quantity: { type: Number, min: 1, required: true },
    variant: mongoose.Schema.Types.ObjectId, // the chosen option, for products that have them
    optionType: String, // snapshot, e.g. "weight"
    optionLabel: String, // snapshot, e.g. "1 kg"
  },
  { _id: false }
);

const statusEventSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES },
    note: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: { type: [orderItemSchema], validate: (v) => v.length > 0 },
    subtotal: Number,
    shipping: Number,
    tax: Number,
    total: Number,
    currency: { type: String, default: 'cad' },
    shippingAddress: addressSchema,
    distanceKm: Number, // from the store's service-area center

    paymentProvider: { type: String, enum: ['stripe', 'mock'] },
    paymentIntentId: { type: String, index: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'pending' },
    paidAt: Date,

    status: { type: String, enum: ORDER_STATUSES, default: 'pending', index: true },
    statusHistory: [statusEventSchema],
  },
  { timestamps: true }
);

orderSchema.methods.setStatus = function setStatus(status, note) {
  this.status = status;
  this.statusHistory.push({ status, note });
};

module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
