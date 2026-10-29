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

// SMS consent is stored per order (CASL: record what they agreed to and when)
const contactSchema = new mongoose.Schema(
  {
    phone: String, // E.164, e.g. +14165550123
    smsOptIn: { type: Boolean, default: false },
    smsConsentAt: Date,
    smsOptOutAt: Date, // set when they reply STOP (see webhook) or opt out in their account
    smsSent: { type: [String], default: [] }, // statuses/notices already texted, prevents duplicates
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
    contact: contactSchema,

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

// Text the customer whenever the status changes, no matter who changed it (admin, driver, carrier poller).
orderSchema.pre('save', function rememberStatusChange() {
  this.$locals.statusChanged = this.isModified('status') && !this.isNew;
});
orderSchema.post('save', function textOnStatusChange(doc) {
  if (!doc.$locals.statusChanged) return;
  doc.$locals.statusChanged = false;
  // Lazy require avoids a circular import (notificationService also uses this model).
  const { notifyStatus } = require('../services/notificationService');
  notifyStatus(doc); // fire-and-forget; it logs its own errors
});

module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
