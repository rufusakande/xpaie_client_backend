// services/fedaPayService.js
const { FedaPay, Transaction } = require('fedapay');

// Configuration de FedaPay
FedaPay.setApiKey(process.env.FEDAPAY_SECRET_KEY);
FedaPay.setEnvironment('sandbox');

class FedaPayService {
  
  /**
   * Crée une transaction FedaPay
   * @param {Object} transactionData - Données de la transaction
   * @returns {Object} Transaction créée
   */
  static async createTransaction(transactionData) {
    try {
      const fedaTransaction = await Transaction.create(transactionData);
      
      if (!fedaTransaction || !fedaTransaction.id) {
        throw new Error('Erreur lors de la création de la transaction FedaPay');
      }

      return fedaTransaction;
    } catch (error) {
      console.error('Erreur FedaPay createTransaction:', error);
      throw error;
    }
  }

  /**
   * Génère un token de paiement pour une transaction
   * @param {Object} transaction - Transaction FedaPay
   * @returns {Object} Token avec URL de paiement
   */
  static async generatePaymentToken(transaction) {
    try {
      const token = await transaction.generateToken();
      
      if (!token || !token.url) {
        throw new Error('Erreur lors de la génération du token de paiement');
      }

      return token;
    } catch (error) {
      console.error('Erreur FedaPay generatePaymentToken:', error);
      throw error;
    }
  }

  /**
   * Récupère le statut d'une transaction FedaPay
   * @param {string} transactionId - ID de la transaction FedaPay
   * @returns {Object} Transaction avec statut mis à jour
   */
  static async getTransactionStatus(transactionId) {
    try {
      const transaction = await Transaction.retrieve(transactionId);
      return transaction;
    } catch (error) {
      console.error('Erreur FedaPay getTransactionStatus:', error);
      throw error;
    }
  }

  /**
   * Traite le paiement automatiquement (simulation)
   * @param {Object} transactionData - Données de la transaction
   * @returns {Object} Résultat du paiement
   */
  static async processAutomaticPayment(transactionData) {
    try {
      // Créer la transaction
      const fedaTransaction = await this.createTransaction(transactionData);
      
      // En mode sandbox, on peut simuler un paiement automatique
      // Dans un vrai environnement, ceci nécessiterait une intégration avec Mobile Money
      
      // Simuler un délai de traitement
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Pour la simulation, on considère que 90% des paiements réussissent
      const success = Math.random() > 0.1;
      
      if (success) {
        return {
          success: true,
          transactionId: fedaTransaction.id,
          status: 'completed',
          message: 'Paiement traité avec succès'
        };
      } else {
        return {
          success: false,
          transactionId: fedaTransaction.id,
          status: 'failed',
          message: 'Échec du paiement'
        };
      }
    } catch (error) {
      console.error('Erreur processAutomaticPayment:', error);
      return {
        success: false,
        status: 'failed',
        message: error.message || 'Erreur lors du traitement du paiement'
      };
    }
  }

  /**
   * Formate les données de transaction pour FedaPay
   * @param {Object} params - Paramètres de la transaction
   * @returns {Object} Données formatées pour FedaPay
   */
  static formatTransactionData({ amount, description, customer }) {
    return {
      description: description,
      amount: parseInt(amount),
      currency: {
        iso: 'XOF'
      },
      callback_url: process.env.FEDAPAY_CALLBACK_URL,
      customer: {
        firstname: customer.firstname,
        lastname: customer.lastname,
        email: customer.email,
        phone_number: {
          number: customer.phone_number,
          country: customer.country || 'BJ'
        }
      }
    };
  }
}

module.exports = FedaPayService;