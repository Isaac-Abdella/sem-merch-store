const router = require('express').Router();
const ctrl = require('../controllers/serviceAreaController');
const { requireServiceArea } = require('../middleware/serviceArea');
const validate = require('../middleware/validate');
const schemas = require('../validators/schemas');

router.get('/', ctrl.getServiceArea);
// Lets the register/checkout forms check an address before submitting
router.post('/check', validate(schemas.serviceAreaCheck), requireServiceArea(), ctrl.checkAddress);

module.exports = router;
