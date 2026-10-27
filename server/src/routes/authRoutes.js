const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { requireServiceArea } = require('../middleware/serviceArea');
const { authLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');

// Registration requires a delivery address inside the delivery radius
router.post('/register', authLimiter, validate(schemas.register), requireServiceArea(), ctrl.register);
router.post('/login', authLimiter, validate(schemas.login), ctrl.login);
router.post('/logout', ctrl.logout);
router.get('/me', protect, ctrl.me);
router.put('/me/address', protect, validate(schemas.updateAddress), requireServiceArea(), ctrl.updateAddress);

module.exports = router;
