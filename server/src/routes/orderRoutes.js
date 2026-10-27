const router = require('express').Router();
const ctrl = require('../controllers/orderController');
const { protect } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');

// Orders are CREATED through /api/payments/create-intent (so payment and order stay in sync).
router.use(protect);

router.get('/mine', ctrl.getMyOrders);
router.get('/', requireAdmin, ctrl.getAllOrders);
router.get('/:id', ctrl.getOrderById);
router.patch('/:id/status', requireAdmin, validate(schemas.updateOrderStatus), ctrl.updateOrderStatus);
router.patch('/:id/assign-driver', requireAdmin, validate(schemas.assignDriver), ctrl.assignDriver);

module.exports = router;
