const mongoose = require('mongoose');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');

// GET /api/products?q=hoodie&category=apparel&page=1&limit=12
async function listProducts(req, res) {
  const { q, category } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));

  const filter = { active: true };
  if (category) filter.category = category;
  if (q) filter.name = { $regex: escapeRegex(q), $options: 'i' };

  const [products, total] = await Promise.all([
    Product.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
  ]);
  res.json({ products, page, pages: Math.ceil(total / limit), total });
}

// GET /api/products/categories
async function listCategories(_req, res) {
  res.json({ categories: await Product.distinct('category', { active: true }) });
}

// GET /api/products/:idOrSlug
async function getProduct(req, res) {
  const { idOrSlug } = req.params;
  const query = mongoose.isValidObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug };
  const product = await Product.findOne(query);
  if (!product || (!product.active && req.user?.role !== 'admin')) throw new AppError('Product not found', 404);
  res.json({ product });
}

// GET /api/products/admin/all   (admin — includes inactive products)
async function listAllProducts(_req, res) {
  res.json({ products: await Product.find().sort({ createdAt: -1 }) });
}

// POST /api/products   (admin)
async function createProduct(req, res) {
  const product = await Product.create(req.body);
  res.status(201).json({ product });
}

// PATCH /api/products/:id   (admin)
async function updateProduct(req, res) {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  Object.assign(product, req.body);
  await product.save();
  res.json({ product });
}

// DELETE /api/products/:id   (admin) — soft delete keeps old orders' references valid
async function deleteProduct(req, res) {
  const product = await Product.findByIdAndUpdate(req.params.id, { active: false }, { returnDocument: 'after' });
  if (!product) throw new AppError('Product not found', 404);
  res.json({ message: 'Product deactivated', product });
}

// DELETE /api/products/:id/permanent   (admin) — removes the document for good.
// Past orders still show the item: they keep their own name/price snapshot.
async function deleteProductPermanently(req, res) {
  const product = await Product.findByIdAndDelete(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  res.json({ message: 'Product deleted' });
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  listProducts,
  listCategories,
  getProduct,
  listAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteProductPermanently,
};
