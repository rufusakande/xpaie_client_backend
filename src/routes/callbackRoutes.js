// routes/callbackRoutes.js
const express = require('express');
const router = express.Router();
const { Transaction } = require('fedapay');
const { db } = require('../config/firebase');

// Route pour gérer le callback de FedaPay
router.get('/callback', async (req, res) => {
  const { id, status } = req.query;
  
  console.log("Callback FedaPay reçu:", req.query);

  try {
    if (!id) {
      console.error('ID de transaction manquant dans le callback');
      return res.redirect(`${process.env.CLIENT_URL}/payment-failed?error=missing_id`);
    }

    // Récupérer la transaction depuis FedaPay
    const fedaTransaction = await Transaction.retrieve(id);
    console.log('Transaction FedaPay récupérée:', fedaTransaction);

    // Chercher la transaction dans Firebase par fedaPayTransactionId
    const transactionsQuery = db.collection('transactions')
      .where('fedaPayTransactionId', '==', id);
    
    const querySnapshot = await transactionsQuery.get();
    
    if (querySnapshot.empty) {
      console.error('Transaction non trouvée dans Firebase pour ID FedaPay:', id);
      return res.redirect(`${process.env.CLIENT_URL}/payment-failed?error=transaction_not_found`);
    }

    // Prendre le premier document (il devrait être unique)
    const transactionDoc = querySnapshot.docs[0];
    const transactionRef = transactionDoc.ref;
    const currentTransactionData = transactionDoc.data();

    let newStatus = 'pending';
    let redirectUrl = '';

    // Déterminer le statut basé sur la réponse FedaPay
    if (fedaTransaction.status === 'approved' || status === 'approved') {
      newStatus = 'completed';
      console.log('Paiement approuvé pour la transaction:', id);
      
      // Mettre à jour le solde de l'utilisateur
      await updateUserBalance(currentTransactionData.userId, currentTransactionData.amount);
      
      redirectUrl = `${process.env.CLIENT_URL}/payment-success?transaction_id=${transactionDoc.id}&amount=${currentTransactionData.amount}`;
    } else if (fedaTransaction.status === 'declined' || status === 'declined') {
      newStatus = 'failed';
      console.log('Paiement refusé pour la transaction:', id);
      redirectUrl = `${process.env.CLIENT_URL}/payment-failed?transaction_id=${transactionDoc.id}&reason=declined`;
    } else if (fedaTransaction.status === 'canceled' || status === 'canceled') {
      newStatus = 'canceled';
      console.log('Paiement annulé pour la transaction:', id);
      redirectUrl = `${process.env.CLIENT_URL}/payment-failed?transaction_id=${transactionDoc.id}&reason=canceled`;
    } else {
      console.log('Paiement en attente pour la transaction:', id, 'Statut:', fedaTransaction.status);
      redirectUrl = `${process.env.CLIENT_URL}/payment-pending?transaction_id=${transactionDoc.id}`;
    }

    // Mettre à jour la transaction dans Firebase
    await transactionRef.update({
      status: newStatus,
      fedaPayStatus: fedaTransaction.status,
      callbackData: {
        timestamp: new Date(),
        queryParams: req.query,
        fedaPayResponse: {
          id: fedaTransaction.id,
          status: fedaTransaction.status,
          amount: fedaTransaction.amount,
          currency: fedaTransaction.currency
        }
      },
      updatedAt: new Date()
    });

    console.log(`Transaction ${transactionDoc.id} mise à jour avec le statut: ${newStatus}`);

    // Rediriger vers l'URL appropriée
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('Erreur lors du traitement du callback:', error);
    res.redirect(`${process.env.CLIENT_URL}/payment-failed?error=callback_processing_error`);
  }
});

// Route POST pour les webhooks FedaPay (recommandé pour la production)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = req.body;
    console.log('Webhook FedaPay reçu:', event);

    // Vérifier la signature du webhook (important pour la sécurité)
    // const signature = req.headers['x-fedapay-signature'];
    // Implémenter la vérification de signature ici

    if (event.type === 'transaction.approved') {
      const transactionId = event.data.id;
      
      // Traiter la transaction approuvée
      await handleApprovedTransaction(transactionId);
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Erreur lors du traitement du webhook:', error);
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});

// Fonction pour mettre à jour le solde de l'utilisateur
async function updateUserBalance(userId, amount) {
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();
      const currentBalance = userData.balance || 0;
      const newBalance = currentBalance + parseInt(amount);

      await userRef.update({
        balance: newBalance,
        lastTransactionAt: new Date()
      });

      console.log(`Solde utilisateur ${userId} mis à jour: ${currentBalance} -> ${newBalance}`);
    } else {
      console.error('Utilisateur non trouvé pour mise à jour du solde:', userId);
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du solde:', error);
    throw error;
  }
}

// Fonction pour traiter une transaction approuvée via webhook
async function handleApprovedTransaction(fedaPayTransactionId) {
  try {
    const transactionsQuery = db.collection('transactions')
      .where('fedaPayTransactionId', '==', fedaPayTransactionId);
    
    const querySnapshot = await transactionsQuery.get();
    
    if (!querySnapshot.empty) {
      const transactionDoc = querySnapshot.docs[0];
      const transactionData = transactionDoc.data();
      
      // Mettre à jour la transaction
      await transactionDoc.ref.update({
        status: 'completed',
        processedAt: new Date(),
        updatedAt: new Date()
      });

      // Mettre à jour le solde utilisateur
      await updateUserBalance(transactionData.userId, transactionData.amount);
      
      console.log('Transaction traitée avec succès via webhook:', fedaPayTransactionId);
    }
  } catch (error) {
    console.error('Erreur lors du traitement de la transaction approuvée:', error);
  }
}

module.exports = router;