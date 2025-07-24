// routes/depositRoutes.js
const express = require('express');
const router = express.Router();
const { 
  createDeposit, 
  getUserTransactions, 
  getTransaction 
} = require('../controllers/depositController');

// Middleware de validation (optionnel)
const validateDepositData = (req, res, next) => {
  const { amount, customer, userId } = req.body;

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Montant invalide'
    });
  }

  if (!customer || !customer.phone_number) {
    return res.status(400).json({
      success: false,
      message: 'Informations client incomplètes'
    });
  }

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: 'ID utilisateur requis'
    });
  }

  next();
};

// Routes
router.post('/create', validateDepositData, createDeposit);
router.get('/user/:userId', getUserTransactions);
router.get('/:transactionId', getTransaction);

module.exports = router;