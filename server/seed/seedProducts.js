/**
 * Seeds sample products and three test accounts.  Run: npm run seed
 * Re-running replaces the products and resets the three seeded accounts.
 */
require('dotenv').config({ quiet: true });
const { connectDB, disconnectDB } = require('../src/config/db');
const Product = require('../src/models/Product');
const User = require('../src/models/User');

const img = (seed) => `https://picsum.photos/seed/${seed}/600/600`;

// Each size gets its own stock; the bigger sizes cost a little more.
const apparelSizes = (price, stocks) =>
  ['S', 'M', 'L', 'XL'].map((label, i) => ({ label, price: label === 'XL' ? price + 500 : price, stock: stocks[i] }));

const products = [
  { name: 'Classic Logo Hoodie', category: 'apparel', optionType: 'size', variants: apparelSizes(5999, [8, 12, 12, 8]), image: img('hoodie'), description: 'Heavyweight fleece hoodie with an embroidered logo.' },
  { name: 'Skyline Tee', category: 'apparel', optionType: 'size', variants: apparelSizes(2999, [15, 25, 25, 15]), image: img('tee'), description: 'Soft cotton tee with a Toronto skyline print.' },
  { name: 'Winter Toque', category: 'accessories', price: 2499, stock: 60, image: img('toque'), description: 'Ribbed knit toque for -20° days.' },
  { name: 'Enamel Pin Set', category: 'accessories', price: 1499, stock: 150, image: img('pins'), description: 'Set of three hard-enamel pins.' },
  { name: 'Insulated Bottle', category: 'drinkware', optionType: 'volume', variants: [{ label: '500 ml', price: 2999, stock: 15 }, { label: '750 ml', price: 3499, stock: 20 }], image: img('bottle'), description: 'Keeps drinks cold for 24 hours, hot for 12.' },
  { name: 'Ceramic Mug', category: 'drinkware', price: 1899, stock: 50, image: img('mug'), description: '12 oz mug, dishwasher safe.' },
  { name: 'House Blend Coffee', category: 'coffee', optionType: 'weight', variants: [{ label: '250 g', price: 1499, stock: 30 }, { label: '500 g', price: 2599, stock: 20 }, { label: '1 kg', price: 4499, stock: 0 }], image: img('coffee'), description: 'Medium roast whole beans. The 1 kg bag is sold out — good for testing!' },
  { name: 'Canvas Tote', category: 'bags', price: 2299, stock: 70, image: img('tote'), description: 'Heavy canvas tote with an inside pocket.' },
  { name: 'Sticker Pack', category: 'accessories', price: 799, stock: 3, image: img('stickers'), description: 'Ten vinyl stickers. Low stock — good for testing stock limits!' },
];

// Inside the service area (downtown Toronto)
const torontoAddress = {
  line1: '100 Queen St W',
  city: 'Toronto',
  province: 'ON',
  postalCode: 'M5H 2N2',
  location: { type: 'Point', coordinates: [-79.3841, 43.6534] },
};

const users = [
  { name: 'Store Admin', email: 'admin@example.com', password: 'Admin123!', role: 'admin', address: torontoAddress },
  { name: 'Dana Driver', email: 'driver@example.com', password: 'Driver123!', role: 'driver', address: torontoAddress },
  { name: 'Casey Customer', email: 'customer@example.com', password: 'Customer123!', role: 'customer', address: { ...torontoAddress, line1: '5100 Yonge St', city: 'North York', postalCode: 'M2N 5V7', location: { type: 'Point', coordinates: [-79.4111, 43.7615] } } },
];

async function seed() {
  await connectDB();

  await Product.deleteMany({});
  // insertMany skips "save" hooks, so create one by one to generate slugs
  for (const p of products) await Product.create(p);
  console.log(`Seeded ${products.length} products`);

  for (const u of users) {
    await User.deleteOne({ email: u.email });
    await User.create(u); // create() runs the password-hashing hook
    console.log(`  ${u.role.padEnd(8)} ${u.email} / ${u.password}`);
  }

  await disconnectDB();
}

seed().catch(async (err) => {
  console.error(err);
  await disconnectDB();
  process.exit(1);
});
