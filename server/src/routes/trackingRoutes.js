const router = require('express').Router();
const ctrl = require('../controllers/trackingController');
const { protect } = require('../middleware/auth');
const { requireDriver } = require('../middleware/admin');
const { trackingLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');

router.use(protect);

router.get('/driver/assigned', requireDriver, ctrl.getAssignedDeliveries);
router.get('/:orderId', ctrl.getTracking);
router.post('/:orderId/location', requireDriver, trackingLimiter, validate(schemas.coords), ctrl.postLocation);
router.post('/:orderId/status', requireDriver, validate(schemas.driverStatus), ctrl.updateDeliveryStatus);

module.exports = router;
