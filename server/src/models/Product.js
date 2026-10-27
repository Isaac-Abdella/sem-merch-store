const mongoose = require('mongoose');

const slugify = (s) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

// What the shopper picks between. "none" = the product is sold as-is.
const OPTION_TYPES = ['none', 'size', 'weight', 'volume'];

// One purchasable option, e.g. { label: 'M' } or { label: '1 kg' }, with its own price and stock.
const variantSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 }, // cents (CAD)
  stock: { type: Number, default: 0, min: 0 },
});

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    description: { type: String, default: '' },
    // With variants, price is the cheapest option ("from $X") and stock is the total — both kept in sync below.
    price: { type: Number, required: true, min: 0 }, // cents (CAD)
    image: { type: String, default: '' },
    category: { type: String, default: 'general', index: true },
    optionType: { type: String, enum: OPTION_TYPES, default: 'none' },
    variants: [variantSchema],
    stock: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text' });

// "./images/x.jpg" or "images/x.jpg" only work on the home page; "/images/x.jpg" works on every page.
const RELATIVE_PATH = /^(?![a-z][a-z0-9+.-]*:|\/)(?:\.\/)?/i; // not "https:", "data:" or already "/..."
const normalizeImage = (image) => (image ? image.trim().replace(RELATIVE_PATH, '/') : image);

productSchema.pre('validate', function syncDerivedFields() {
  if (this.isModified('name') || !this.slug) this.slug = slugify(this.name || '');
  if (this.isModified('image')) this.image = normalizeImage(this.image);
  if (this.optionType === 'none') this.variants = [];
  if (this.variants.length) {
    this.price = Math.min(...this.variants.map((v) => v.price));
    this.stock = this.variants.reduce((sum, v) => sum + v.stock, 0);
  }
});

module.exports = mongoose.model('Product', productSchema);
module.exports.slugify = slugify;
module.exports.OPTION_TYPES = OPTION_TYPES;
