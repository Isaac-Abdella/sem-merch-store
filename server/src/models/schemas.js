// Sub-schemas shared by several models.
const mongoose = require('mongoose');

// GeoJSON Point: coordinates are [longitude, latitude] — note the order!
const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2,
        message: 'coordinates must be [lng, lat]',
      },
    },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, trim: true },
    province: { type: String, trim: true, default: 'ON' },
    postalCode: { type: String, trim: true, uppercase: true },
    country: { type: String, default: 'CA' },
    location: pointSchema, // set server-side from the geocoder, never from the client
  },
  { _id: false }
);

module.exports = { pointSchema, addressSchema };
