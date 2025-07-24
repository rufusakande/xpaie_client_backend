// utils/logger.js
const winston = require('winston');

// Configuration des formats de log
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.simple()
);

// Création du logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'fedapay-api' },
  transports: [
    // Logs d'erreur dans un fichier séparé
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Tous les logs dans un fichier général
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// En développement, on ajoute aussi la console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Méthodes utilitaires pour les logs spécifiques
const logTransaction = (action, transactionId, userId, details = {}) => {
  logger.info('Transaction', {
    action,
    transactionId,
    userId,
    ...details
  });
};

const logPayment = (action, paymentId, amount, status, details = {}) => {
  logger.info('Payment', {
    action,
    paymentId,
    amount,
    status,
    ...details
  });
};

const logError = (error, context = {}) => {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    ...context
  });
};

const logWebhook = (event, data, status = 'received') => {
  logger.info('Webhook', {
    event,
    status,
    data: typeof data === 'object' ? JSON.stringify(data) : data
  });
};

module.exports = {
  logger,
  logTransaction,
  logPayment,
  logError,
  logWebhook
};