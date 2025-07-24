// controllers/depositsController.js
const { FedaPay, Transaction } = require('fedapay');
const { db } = require('../config/firebase');

// Configuration de FedaPay
FedaPay.setApiKey(process.env.FEDAPAY_SECRET_KEY);
FedaPay.setEnvironment('sandbox');

const createDeposit = async (req, res) => {
  try {
    const { amount, customer, description, userId } = req.body;
    console.log('Données de dépôt reçues:', req.body);
    // Validation des données requises
    if (!amount || !customer || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Montant, informations client et ID utilisateur requis'
      });
    }
    // Validation du montant minimum (par exemple 100 XOF)
    if (parseInt(amount) < 100) {
      return res.status(400).json({
        success: false,
        message: 'Le montant minimum est de 100 XOF'
      });
    }

    // Vérifier que l'utilisateur existe dans Firebase
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const userData = userDoc.data();

    // Préparation des données de la transaction FedaPay
    const transactionData = {
      description: description || `Dépôt - ${userData.name}`,
      amount: parseInt(amount),
      currency: {
        iso: 'XOF'
      },
      callback_url: process.env.FEDAPAY_CALLBACK_URL,
      customer: {
        firstname: customer.firstname || userData.name.split(' ')[0],
        lastname: customer.lastname || userData.name.split(' ')[1] || '',
        email: customer.email || userData.email,
        phone_number: {
          /* number: customer.phone_number.replace(/\D/g, ''), */
          number: '+22997808080',
          country: customer.country || userData.country || 'BJ'
        }
      }
    };

    console.log('Données de transaction FedaPay:', JSON.stringify(transactionData, null, 2));

    // Création de la transaction FedaPay
    const fedaTransaction = await Transaction.create(transactionData);
    
    if (!fedaTransaction || !fedaTransaction.id) {
      throw new Error('Erreur lors de la création de la transaction FedaPay');
    }

    // Génération du token pour obtenir l'URL de paiement
    const token = await fedaTransaction.generateToken();
    
    if (!token || !token.url) {
      throw new Error('Erreur lors de la génération du token de paiement');
    }

    // Enregistrer la transaction dans Firebase
    const transactionRef = db.collection('transactions').doc();
    const transactionDoc = {
      id: transactionRef.id,
      userId: userId,
      fedaPayTransactionId: fedaTransaction.id,
      type: 'deposit',
      amount: parseInt(amount),
      currency: 'XOF',
      status: 'pending',
      description: transactionData.description,
      customer: {
        firstname: transactionData.customer.firstname,
        lastname: transactionData.customer.lastname,
        email: transactionData.customer.email,
        phone_number: customer.phone_number,
        country: customer.country || 'BJ'
      },
      paymentUrl: token.url,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await transactionRef.set(transactionDoc);

    console.log('Transaction enregistrée avec succès:', transactionRef.id);

    // Retourner la réponse avec les informations nécessaires
    res.status(200).json({
      success: true,
      data: {
        transactionId: transactionRef.id,
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
    
    // Gestion spécifique des erreurs FedaPay
    let errorMessage = 'Erreur lors de la création du dépôt';
    let statusCode = 500;

    if (error.message) {
      if (error.message.includes('Invalid phone number')) {
        errorMessage = 'Numéro de téléphone invalide';
        statusCode = 400;
      } else if (error.message.includes('Invalid email')) {
        errorMessage = 'Adresse email invalide';
        statusCode = 400;
      } else if (error.message.includes('Amount')) {
        errorMessage = 'Montant invalide';
        statusCode = 400;
      } else if (error.message.includes('network') || error.message.includes('timeout')) {
        errorMessage = 'Problème de connexion. Veuillez réessayer';
        statusCode = 503;
      }
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Fonction pour récupérer les transactions d'un utilisateur
const getUserTransactions = async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, status } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'ID utilisateur requis'
      });
    }

    let query = db.collection('transactions')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit));

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.get();
    const transactions = [];

    snapshot.forEach(doc => {
      transactions.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate()
      });
    });

    res.status(200).json({
      success: true,
      data: transactions,
      count: transactions.length
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des transactions'
    });
  }
};

// Fonction pour récupérer une transaction spécifique
const getTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: 'ID de transaction requis'
      });
    }

    const transactionDoc = await db.collection('transactions').doc(transactionId).get();

    if (!transactionDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Transaction non trouvée'
      });
    }

    const transactionData = transactionDoc.data();

    res.status(200).json({
      success: true,
      data: {
        id: transactionDoc.id,
        ...transactionData,
        createdAt: transactionData.createdAt.toDate(),
        updatedAt: transactionData.updatedAt.toDate()
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la transaction'
    });
  }
};

module.exports = {
  createDeposit,
  getUserTransactions,
  getTransaction
};