// services/userService.js
const { db } = require('../config/firebase');

class UserService {
  
  /**
   * Récupère un utilisateur par son ID
   * @param {string} userId - ID de l'utilisateur
   * @returns {Object} Données de l'utilisateur
   */
  static async getUserById(userId) {
    try {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        throw new Error('Utilisateur non trouvé');
      }

      const userData = userDoc.data();
      return {
        id: userDoc.id,
        ...userData
      };
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'utilisateur:', error);
      throw error;
    }
  }

  /**
   * Met à jour les informations d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {Object} updateData - Données à mettre à jour
   * @returns {Object} Utilisateur mis à jour
   */
  static async updateUser(userId, updateData) {
    try {
      const userRef = db.collection('users').doc(userId);
      const updatePayload = {
        ...updateData,
        updatedAt: new Date()
      };

      await userRef.update(updatePayload);
      
      // Récupérer l'utilisateur mis à jour
      const updatedDoc = await userRef.get();
      return {
        id: updatedDoc.id,
        ...updatedDoc.data()
      };
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'utilisateur:', error);
      throw error;
    }
  }

  /**
   * Complète les informations client avec les données utilisateur
   * @param {Object} customer - Informations client fournies
   * @param {Object} userData - Données utilisateur de la base
   * @returns {Object} Informations client complétées
   */
  static completeCustomerInfo(customer, userData) {
    return {
      firstname: customer.firstname || userData.name?.split(' ')[0] || 'Prénom',
      lastname: customer.lastname || userData.name?.split(' ')[1] || 'Nom',
      email: customer.email || userData.email || 'noemail@example.com',
      phone_number: customer.phone_number || '+22997808080',
      country: customer.country || userData.country || 'BJ'
    };
  }

  /**
   * Vérifie si un utilisateur existe
   * @param {string} userId - ID de l'utilisateur
   * @returns {boolean} True si l'utilisateur existe
   */
  static async userExists(userId) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      return userDoc.exists;
    } catch (error) {
      console.error('Erreur lors de la vérification de l\'utilisateur:', error);
      return false;
    }
  }

  /**
   * Récupère le solde d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {number} Solde de l'utilisateur
   */
  static async getUserBalance(userId) {
    try {
      const userData = await this.getUserById(userId);
      return userData.balance || 0;
    } catch (error) {
      console.error('Erreur lors de la récupération du solde:', error);
      return 0;
    }
  }
}

module.exports = UserService;