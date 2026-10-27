const router = require('express').Router();
const ctrl = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { requireServiceArea } = require('../middleware/serviceArea');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');

router.get('/config', ctrl.getPaymentConfig);

// Checkout: validate cart → geofence the shipping address → price from DB → create payment
router.post(
  '/create-intent',
  protect,
  validate(schemas.createPaymentIntent),
  requireServiceArea((req) => req.body.shippingAddress),
  ctrl.createPaymentIntent
);

// Development only: complete a mock payment
router.post('/mock/:orderId/confirm', protect, ctrl.confirmMockPayment);

module.exports = router;
