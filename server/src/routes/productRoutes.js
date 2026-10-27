const router = require('express').Router();
const ctrl = require('../controllers/productController');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');

// Public
router.get('/', ctrl.listProducts);
router.get('/categories', ctrl.listCategories);

// Admin (declared before /:idOrSlug so "admin" isn't treated as a slug)
router.get('/admin/all', protect, requireAdmin, ctrl.listAllProducts);
router.post('/', protect, requireAdmin, validate(schemas.product), ctrl.createProduct);
router.patch('/:id', protect, requireAdmin, validate(schemas.productUpdate), ctrl.updateProduct);
router.delete('/:id', protect, requireAdmin, ctrl.deleteProduct);
router.delete('/:id/permanent', protect, requireAdmin, ctrl.deleteProductPermanently);

router.get('/:idOrSlug', ctrl.getProduct);

module.exports = router;
