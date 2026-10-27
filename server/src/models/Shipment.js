const mongoose = require('mongoose');
const { pointSchema } = require('./schemas');

const MAX_PATH_POINTS = 500;

const shipmentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    // "local" = your own drivers posting GPS; otherwise a carrier with a tracking number
    carrier: { type: String, enum: ['local', 'canada_post', 'purolator', 'ups', 'fedex'], default: 'local' },
    trackingNumber: String,
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    origin: pointSchema,
    destination: pointSchema,
    currentLocation: pointSchema,
    lastLocationAt: Date,
    // Breadcrumb trail drawn as a line on the map (capped)
    path: [
      {
        _id: false,
        lat: Number,
        lng: Number,
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

shipmentSchema.methods.recordLocation = function recordLocation({ lat, lng }) {
  this.currentLocation = { type: 'Point', coordinates: [lng, lat] };
  this.lastLocationAt = new Date();
  this.path.push({ lat, lng });
  if (this.path.length > MAX_PATH_POINTS) this.path.splice(0, this.path.length - MAX_PATH_POINTS);
};

module.exports = mongoose.model('Shipment', shipmentSchema);
