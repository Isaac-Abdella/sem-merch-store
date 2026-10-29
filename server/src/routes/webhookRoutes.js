const express = require('express');
const { handleStripeWebhook, handleUberDirectWebhook } = require('../controllers/webhookController');

const router = express.Router();

// Stripe signature verification needs the exact raw bytes, so this router is mounted in app.js
// BEFORE express.json() and parses the body as a Buffer.
router.post('/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Uber Direct also signs the raw body (HMAC-SHA256 in x-uber-signature)
router.post('/uber-direct', express.raw({ type: 'application/json' }), handleUberDirectWebhook);

module.exports = router;
