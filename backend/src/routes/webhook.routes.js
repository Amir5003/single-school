const express = require('express');
const webhookController = require('../controllers/webhook.controller');

const router = express.Router();

// Razorpay payment webhook — unauthenticated; HMAC-verified inside the
// controller. Must read raw body for signature verification — the parent
// app mounts an `express.json({ verify })` middleware that attaches
// `req.rawBody`.
router.post('/payment', webhookController.handlePaymentWebhook);

module.exports = router;
