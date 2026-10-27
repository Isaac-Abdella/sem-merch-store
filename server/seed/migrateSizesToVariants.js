/**
 * One-off migration: turns the old `sizes: ['S', 'M']` list into per-option variants.
 * Each size gets the product's current price, and the product's stock is split evenly
 * between its sizes (adjust them afterwards in Admin → Products). Safe to run twice.
 * Run: npm run migrate:variants
 */
require('dotenv').config({ quiet: true });
const { connectDB, disconnectDB } = require('../src/config/db');
const Product = require('../src/models/Product');

async function migrate() {
  await connectDB();
  // Read through the raw collection: `sizes` is no longer in the Mongoose schema.
  const docs = await Product.collection.find({ sizes: { $exists: true } }).toArray();

  for (const doc of docs) {
    const sizes = (doc.sizes || []).filter(Boolean);
    const product = await Product.findById(doc._id);
    if (sizes.length && !product.variants.length) {
      const each = Math.floor(product.stock / sizes.length);
      const extra = product.stock % sizes.length;
      product.optionType = 'size';
      product.variants = sizes.map((label, i) => ({ label, price: product.price, stock: each + (i < extra ? 1 : 0) }));
      await product.save();
      console.log(`  ${product.name}: ${sizes.join(', ')}`);
    }
    await Product.collection.updateOne({ _id: doc._id }, { $unset: { sizes: '' } });
  }

  console.log(`Checked ${docs.length} products with the old sizes field`);
  await disconnectDB();
}

migrate().catch(async (err) => {
  console.error(err);
  await disconnectDB();
  process.exit(1);
});
