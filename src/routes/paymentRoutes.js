// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();

const {
  handleFedaPayWebhook,
  handlePaymentCallback
} = require('../controllers/webhookController');

// Route pour les webhooks FedaPay
router.post('/webhook', express.raw({ type: 'application/json' }), handleFedaPayWebhook);

// Route pour les callbacks de retour de paiement
router.get('/callback', handlePaymentCallback);

module.exports = router;