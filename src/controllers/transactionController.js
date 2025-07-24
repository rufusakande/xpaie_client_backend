// controllers/transactionController.js
const TransactionService = require('../services/transactionService');

/**
 * Récupère les transactions d'un utilisateur
 */
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

    const transactions = await TransactionService.getUserTransactions(userId, {
      limit,
      status
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

/**
 * Récupère une transaction spécifique
 */
const getTransaction = async (req, res) => {
  try {
    const { transactionId } = req.params;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: 'ID de transaction requis'
      });
    }

    const transaction = await TransactionService.getTransactionById(transactionId);

    res.status(200).json({
      success: true,
      data: transaction
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la transaction:', error);
    
    if (error.message === 'Transaction non trouvée') {
      return res.status(404).json({
        success: false,
        message: 'Transaction non trouvée'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la transaction'
    });
  }
};

/**
 * Met à jour le statut d'une transaction
 */
const updateTransactionStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status, message } = req.body;

    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: 'ID de transaction requis'
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Statut requis'
      });
    }

    const updatedTransaction = await TransactionService.updateTransactionStatus(
      transactionId,
      {
        status,
        processingMessage: message
      }
    );

    res.status(200).json({
      success: true,
      data: updatedTransaction,
      message: 'Transaction mise à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour de la transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la transaction'
    });
  }
};

/**
 * Récupère les statistiques des transactions d'un utilisateur
 */
const getUserTransactionStats = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'ID utilisateur requis'
      });
    }

    // Récupérer toutes les transactions
    const allTransactions = await TransactionService.getUserTransactions(userId, { limit: 1000 });
    
    // Calculer les statistiques
    const stats = {
      totalTransactions: allTransactions.length,
      completedTransactions: allTransactions.filter(t => t.status === 'completed').length,
      pendingTransactions: allTransactions.filter(t => t.status === 'pending').length,
      failedTransactions: allTransactions.filter(t => t.status === 'failed').length,
      totalDeposited: allTransactions
        .filter(t => t.status === 'completed' && t.type === 'deposit')
        .reduce((sum, t) => sum + t.amount, 0),
      averageAmount: allTransactions.length > 0 
        ? Math.round(allTransactions.reduce((sum, t) => sum + t.amount, 0) / allTransactions.length)
        : 0
    };

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
};

module.exports = {
  getUserTransactions,
  getTransaction,
  updateTransactionStatus,
  getUserTransactionStats
};