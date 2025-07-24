// services/transactionService.js
const { db } = require('../config/firebase');

class TransactionService {
  
  /**
   * Crée une nouvelle transaction dans Firestore
   * @param {Object} transactionData - Données de la transaction
   * @returns {Object} Transaction créée
   */
  static async createTransaction(transactionData) {
    try {
      const transactionRef = db.collection('transactions').doc();
      const transactionDoc = {
        id: transactionRef.id,
        ...transactionData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await transactionRef.set(transactionDoc);
      
      console.log('Transaction enregistrée avec succès:', transactionRef.id);
      return transactionDoc;
    } catch (error) {
      console.error('Erreur lors de la création de la transaction:', error);
      throw error;
    }
  }

  /**
   * Met à jour le statut d'une transaction
   * @param {string} transactionId - ID de la transaction
   * @param {Object} updateData - Données à mettre à jour
   * @returns {Object} Transaction mise à jour
   */
  static async updateTransactionStatus(transactionId, updateData) {
    try {
      const transactionRef = db.collection('transactions').doc(transactionId);
      const updatePayload = {
        ...updateData,
        updatedAt: new Date()
      };

      await transactionRef.update(updatePayload);
      
      // Récupérer la transaction mise à jour
      const updatedDoc = await transactionRef.get();
      return {
        id: updatedDoc.id,
        ...updatedDoc.data()
      };
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la transaction:', error);
      throw error;
    }
  }

  /**
   * Récupère une transaction par son ID
   * @param {string} transactionId - ID de la transaction
   * @returns {Object} Transaction trouvée
   */
  static async getTransactionById(transactionId) {
    try {
      const transactionDoc = await db.collection('transactions').doc(transactionId).get();

      if (!transactionDoc.exists) {
        throw new Error('Transaction non trouvée');
      }

      const transactionData = transactionDoc.data();
      return {
        id: transactionDoc.id,
        ...transactionData,
        createdAt: transactionData.createdAt.toDate(),
        updatedAt: transactionData.updatedAt.toDate()
      };
    } catch (error) {
      console.error('Erreur lors de la récupération de la transaction:', error);
      throw error;
    }
  }

  /**
   * Récupère les transactions d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} options - Options de filtrage
   * @returns {Array} Liste des transactions
   */
  static async getUserTransactions(userId, options = {}) {
    try {
      const { limit = 10, status } = options;

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
        const data = doc.data();
        transactions.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate()
        });
      });

      return transactions;
    } catch (error) {
      console.error('Erreur lors de la récupération des transactions:', error);
      throw error;
    }
  }

  /**
   * Met à jour le solde de l'utilisateur après un dépôt réussi
   * @param {string} userId - ID de l'utilisateur
   * @param {number} amount - Montant à ajouter
   * @returns {Object} Données utilisateur mises à jour
   */
  static async updateUserBalance(userId, amount) {
    try {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error('Utilisateur non trouvé');
      }

      const userData = userDoc.data();
      const currentBalance = userData.balance || 0;
      const newBalance = currentBalance + parseInt(amount);

      await userRef.update({
        balance: newBalance,
        updatedAt: new Date()
      });

      return {
        ...userData,
        balance: newBalance,
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Erreur lors de la mise à jour du solde:', error);
      throw error;
    }
  }

  /**
   * Valide les données de transaction
   * @param {Object} data - Données à valider
   * @returns {Object} Résultat de la validation
   */
  static validateTransactionData(data) {
    const errors = [];

    if (!data.amount || isNaN(data.amount) || parseInt(data.amount) < 100) {
      errors.push('Le montant minimum est de 100 XOF');
    }

    if (!data.customer || !data.customer.phone_number) {
      errors.push('Numéro de téléphone requis');
    }

    if (!data.userId) {
      errors.push('ID utilisateur requis');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = TransactionService;