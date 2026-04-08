const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createCheckoutSession, confirmPayment, handleWebhook } = require('../controllers/paymentController');

router.post('/create-session/:groupId', authenticate, createCheckoutSession);
router.post('/confirm', authenticate, confirmPayment);

// webhook endpoint (Stripe will POST here) - do NOT use authenticate middleware
const bodyParser = require('body-parser');
router.post('/webhook', bodyParser.raw({ type: 'application/json' }), handleWebhook);

module.exports = router;
