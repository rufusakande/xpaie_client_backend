// controllers/webhookController.js
const FedaPayService = require('../services/fedaPayService');
const TransactionService = require('../services/transactionService');
const UserService = require('../services/userService');
const crypto = require('crypto');

/**
 * Gère les webhooks de FedaPay
 */
const handleFedaPayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-fedapay-signature'];
    const payload = JSON.stringify(req.body);
    
    // Vérifier la signature du webhook (sécurité)
    if (!verifyWebhookSignature(payload, signature)) {
      console.error('Signature webhook invalide');
      return res.status(401).json({
        success: false,
        message: 'Signature invalide'
      });
    }

    const { event, data } = req.body;
    console.log('Webhook reçu:', event, data);

    switch (event) {
      case 'transaction.approved':
        await handleTransactionApproved(data);
        break;
      case 'transaction.declined':
        await handleTransactionDeclined(data);
        break;
      case 'transaction.failed':
        await handleTransactionFailed(data);
        break;
      default:
        console.log('Événement webhook non géré:', event);
    }

    res.status(200).json({
      success: true,
      message: 'Webhook traité avec succès'
    });

  } catch (error) {
    console.error('Erreur lors du traitement du webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du traitement du webhook'
    });
  }
};

/**
 * Gère l'approbation d'une transaction
 */
const handleTransactionApproved = async (transactionData) => {
  try {
    const { transaction_id } = transactionData;
    
    // Trouver la transaction dans notre base de données
    const transactions = await TransactionService.getUserTransactions('all');
    const dbTransaction = transactions.find(t => t.fedaPayTransactionId === transaction_id);
    
    if (!dbTransaction) {
      console.error('Transaction non trouvée:', transaction_id);
      return;
    }

    // Mettre à jour le statut de la transaction
    await TransactionService.updateTransactionStatus(dbTransaction.id, {
      status: 'completed',
      processingMessage: 'Paiement approuvé par FedaPay'
    });

    // Mettre à jour le solde de l'utilisateur si c'est un dépôt
    if (dbTransaction.type === 'deposit') {
      await TransactionService.updateUserBalance(dbTransaction.userId, dbTransaction.amount);
      console.log(`Solde mis à jour pour l'utilisateur ${dbTransaction.userId}: +${dbTransaction.amount} XOF`);
    }

  } catch (error) {
    console.error('Erreur lors du traitement de l\'approbation:', error);
  }
};

/**
 * Gère le refus d'une transaction
 */
const handleTransactionDeclined = async (transactionData) => {
  try {
    const { transaction_id, reason } = transactionData;
    
    // Trouver la transaction dans notre base de données
    const transactions = await TransactionService.getUserTransactions('all');
    const dbTransaction = transactions.find(t => t.fedaPayTransactionId === transaction_id);
    
    if (!dbTransaction) {
      console.error('Transaction non trouvée:', transaction_id);
      return;
    }

    // Mettre à jour le statut de la transaction
    await TransactionService.updateTransactionStatus(dbTransaction.id, {
      status: 'declined',
      processingMessage: `Paiement refusé: ${reason || 'Raison inconnue'}`
    });

    console.log(`Transaction ${dbTransaction.id} refusée:`, reason);

  } catch (error) {
    console.error('Erreur lors du traitement du refus:', error);
  }
};

/**
 * Gère l'échec d'une transaction
 */
const handleTransactionFailed = async (transactionData) => {
  try {
    const { transaction_id, error_message } = transactionData;
    
    // Trouver la transaction dans notre base de données
    const transactions = await TransactionService.getUserTransactions('all');
    const dbTransaction = transactions.find(t => t.fedaPayTransactionId === transaction_id);
    
    if (!dbTransaction) {
      console.error('Transaction non trouvée:', transaction_id);
      return;
    }

    // Mettre à jour le statut de la transaction
    await TransactionService.updateTransactionStatus(dbTransaction.id, {
      status: 'failed',
      processingMessage: `Échec du paiement: ${error_message || 'Erreur inconnue'}`
    });

    console.log(`Transaction ${dbTransaction.id} échouée:`, error_message);

  } catch (error) {
    console.error('Erreur lors du traitement de l\'échec:', error);
  }
};

/**
 * Vérifie la signature du webhook
 */
const verifyWebhookSignature = (payload, signature) => {
  if (!process.env.FEDAPAY_WEBHOOK_SECRET) {
    console.warn('FEDAPAY_WEBHOOK_SECRET non configuré');
    return true; // En développement, on peut ignorer la vérification
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.FEDAPAY_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature || ''),
    Buffer.from(expectedSignature)
  );
};

/**
 * Gère les callbacks de retour de paiement
 */
const handlePaymentCallback = async (req, res) => {
  try {
    const { transaction_id, status } = req.query;
    
    if (!transaction_id) {
      return res.status(400).json({
        success: false,
        message: 'ID de transaction requis'
      });
    }

    // Récupérer le statut réel depuis FedaPay
    const fedaTransaction = await FedaPayService.getTransactionStatus(transaction_id);
    
    // Trouver la transaction dans notre base de données
    const transactions = await TransactionService.getUserTransactions('all');
    const dbTransaction = transactions.find(t => t.fedaPayTransactionId === transaction_id);
    
    if (!dbTransaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction non trouvée'
      });
    }

    // Mettre à jour le statut selon la réponse de FedaPay
    let newStatus = 'pending';
    let message = 'Paiement en cours de traitement';

    switch (fedaTransaction.status) {
      case 'approved':
        newStatus = 'completed';
        message = 'Paiement réussi';
        // Mettre à jour le solde si c'est un dépôt
        if (dbTransaction.type === 'deposit') {
          await TransactionService.updateUserBalance(dbTransaction.userId, dbTransaction.amount);
        }
        break;
      case 'declined':
        newStatus = 'declined';
        message = 'Paiement refusé';
        break;
      case 'failed':
        newStatus = 'failed';
        message = 'Paiement échoué';
        break;
    }

    await TransactionService.updateTransactionStatus(dbTransaction.id, {
      status: newStatus,
      processingMessage: message
    });

    // Rediriger vers le frontend avec le résultat
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/payment/result?status=${newStatus}&transaction=${dbTransaction.id}`);

  } catch (error) {
    console.error('Erreur lors du callback de paiement:', error);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/payment/result?status=error`);
  }
};

module.exports = {
  handleFedaPayWebhook,
  handlePaymentCallback
};