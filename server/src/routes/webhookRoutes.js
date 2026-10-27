const express = require('express');
const { handleStripeWebhook } = require('../controllers/webhookController');

const router = express.Router();

// Stripe signature verification needs the exact raw bytes, so this router is mounted in app.js
// BEFORE express.json() and parses the body as a Buffer.
router.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

module.exports = router;
