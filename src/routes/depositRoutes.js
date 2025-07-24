// routes/depositRoutes.js
const express = require('express');
const router = express.Router();

// Importation des contrôleurs
const {
  createAutomaticDeposit,
  createDeposit
} = require('../controllers/depositController');

const {
  getUserTransactions,
  getTransaction,
  updateTransactionStatus,
  getUserTransactionStats
} = require('../controllers/transactionController');

// Middleware de validation
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

// Routes pour les dépôts
router.post('/create/automatic', validateDepositData, createAutomaticDeposit);
router.post('/create/manual', validateDepositData, createDeposit);

// Routes pour les transactions
router.get('/user/:userId', getUserTransactions);
router.get('/user/:userId/stats', getUserTransactionStats);
router.get('/:transactionId', getTransaction);
router.put('/:transactionId/status', updateTransactionStatus);

module.exports = router;