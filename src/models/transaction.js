const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optionnel si pas de système d'auth
  },
  fedaPayId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdrawal'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: [100, 'Le montant minimum est de 100 XOF']
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  currency: {
    type: String,
    required: true,
    default: 'XOF'
  },
  description: {
    type: String,
    required: true
  },
  customerInfo: {
    firstname: {
      type: String,
      required: true
    },
    lastname: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true
    },
    phone_number: {
      type: String,
      required: true
    },
    country: {
      type: String,
      default: 'BJ'
    }
  },
  paymentMethod: {
    type: String,
    enum: ['mtn', 'moov', 'card', 'other'],
    default: 'other'
  },
  metadata: {
    type: Map,
    of: String,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Ajoute automatiquement createdAt et updatedAt
});

// Index composé pour les requêtes fréquentes
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ userId: 1, status: 1 });
transactionSchema.index({ customerInfo: { email: 1 } });

// Middleware pour mettre à jour updatedAt
transactionSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  next();
});

// Méthodes d'instance
transactionSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Méthodes statiques
transactionSchema.statics.findByFedaPayId = function(fedaPayId) {
  return this.findOne({ fedaPayId });
};

transactionSchema.statics.findPendingTransactions = function() {
  return this.find({ status: 'pending' }).sort({ createdAt: -1 });
};

transactionSchema.statics.getTransactionStats = function(userId = null) {
  const match = userId ? { userId: new mongoose.Types.ObjectId(userId) } : {};
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
};

module.exports = mongoose.model('Transaction', transactionSchema);