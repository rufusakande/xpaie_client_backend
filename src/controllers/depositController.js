// controllers/depositController.js
const FedaPayService = require('../services/fedaPayService');
const TransactionService = require('../services/transactionService');
const UserService = require('../services/userService');

/**
 * Crée un nouveau dépôt avec traitement automatique
 */
const createAutomaticDeposit = async (req, res) => {
  try {
    const { amount, customer, description, userId } = req.body;
    console.log('Données de dépôt reçues:', req.body);

    // Validation des données
    const validation = TransactionService.validateTransactionData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: validation.errors
      });
    }

    // Vérifier que l'utilisateur existe
    const userData = await UserService.getUserById(userId);
    
    // Compléter les informations client
    const completeCustomer = UserService.completeCustomerInfo(customer, userData);
    
    // Préparer les données de transaction
    const transactionData = FedaPayService.formatTransactionData({
      amount,
      description: description || `Dépôt automatique - ${userData.name}`,
      customer: completeCustomer
    });

    console.log('Données de transaction FedaPay:', JSON.stringify(transactionData, null, 2));

    // Créer la transaction en base de données (statut pending)
    const dbTransaction = await TransactionService.createTransaction({
      userId: userId,
      type: 'deposit',
      amount: parseInt(amount),
      currency: 'XOF',
      status: 'pending',
      description: transactionData.description,
      customer: completeCustomer,
      processingType: 'automatic'
    });

    // Traiter le paiement automatiquement
    const paymentResult = await FedaPayService.processAutomaticPayment(transactionData);
    
    // Mettre à jour le statut de la transaction
    const updatedTransaction = await TransactionService.updateTransactionStatus(
      dbTransaction.id,
      {
        fedaPayTransactionId: paymentResult.transactionId,
        status: paymentResult.status,
        processingMessage: paymentResult.message
      }
    );

    // Si le paiement est réussi, mettre à jour le solde de l'utilisateur
    if (paymentResult.success && paymentResult.status === 'completed') {
      await TransactionService.updateUserBalance(userId, parseInt(amount));
      
      console.log(`Dépôt de ${amount} XOF traité avec succès pour l'utilisateur ${userId}`);
      
      return res.status(200).json({
        success: true,
        data: {
          transactionId: updatedTransaction.id,
          fedaPayTransactionId: paymentResult.transactionId,
          amount: parseInt(amount),
          currency: 'XOF',
          status: 'completed',
          newBalance: await UserService.getUserBalance(userId)
        },
        message: 'Dépôt traité avec succès'
      });
    } else {
      // Paiement échoué
      console.log(`Échec du dépôt pour l'utilisateur ${userId}: ${paymentResult.message}`);
      
      return res.status(400).json({
        success: false,
        data: {
          transactionId: updatedTransaction.id,
          fedaPayTransactionId: paymentResult.transactionId,
          amount: parseInt(amount),
          currency: 'XOF',
          status: 'failed'
        },
        message: paymentResult.message || 'Échec du traitement du paiement'
      });
    }

  } catch (error) {
    console.error('Erreur lors de la création du dépôt automatique:', error);
    
    // Gestion des erreurs spécifiques
    let errorMessage = 'Erreur lors du traitement du dépôt';
    let statusCode = 500;

    if (error.message === 'Utilisateur non trouvé') {
      errorMessage = 'Utilisateur non trouvé';
      statusCode = 404;
    } else if (error.message.includes('phone number')) {
      errorMessage = 'Numéro de téléphone invalide';
      statusCode = 400;
    } else if (error.message.includes('email')) {
      errorMessage = 'Adresse email invalide';
      statusCode = 400;
    } else if (error.message.includes('network') || error.message.includes('timeout')) {
      errorMessage = 'Problème de connexion. Veuillez réessayer';
      statusCode = 503;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Crée un dépôt traditionnel avec URL de paiement
 */
const createDeposit = async (req, res) => {
  try {
    const { amount, customer, description, userId } = req.body;
    console.log('Données de dépôt reçues:', req.body);

    // Validation des données
    const validation = TransactionService.validateTransactionData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: validation.errors
      });
    }

    // Vérifier que l'utilisateur existe
    const userData = await UserService.getUserById(userId);
    
    // Compléter les informations client
    const completeCustomer = UserService.completeCustomerInfo(customer, userData);
    
    // Préparer les données de transaction
    const transactionData = FedaPayService.formatTransactionData({
      amount,
      description: description || `Dépôt - ${userData.name}`,
      customer: completeCustomer
    });

    // Créer la transaction FedaPay
    const fedaTransaction = await FedaPayService.createTransaction(transactionData);
    
    // Générer le token de paiement
    const token = await FedaPayService.generatePaymentToken(fedaTransaction);

    // Enregistrer la transaction dans la base de données
    const dbTransaction = await TransactionService.createTransaction({
      userId: userId,
      fedaPayTransactionId: fedaTransaction.id,
      type: 'deposit',
      amount: parseInt(amount),
      currency: 'XOF',
      status: 'pending',
      description: transactionData.description,
      customer: completeCustomer,
      paymentUrl: token.url,
      processingType: 'manual'
    });

    res.status(200).json({
      success: true,
      data: {
        transactionId: dbTransaction.id,
        fedaPayTransactionId: fedaTransaction.id,
        paymentUrl: token.url,
        amount: parseInt(amount),
        currency: 'XOF',
        status: 'pending'
      },
      message: 'Transaction créée avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la création du dépôt:', error);
    
    let errorMessage = 'Erreur lors de la création du dépôt';
    let statusCode = 500;

    if (error.message === 'Utilisateur non trouvé') {
      errorMessage = 'Utilisateur non trouvé';
      statusCode = 404;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createAutomaticDeposit,
  createDeposit
};