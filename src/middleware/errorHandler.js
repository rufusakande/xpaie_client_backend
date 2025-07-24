// middleware/errorHandler.js

/**
 * Middleware de gestion globale des erreurs
 */
const errorHandler = (err, req, res, next) => {
  console.error('Erreur interceptée:', err);

  // Erreur de validation Joi
  if (err.isJoi) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: err.details.map(detail => detail.message)
    });
  }

  // Erreur de validation personnalisée
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: Object.values(err.errors).map(error => error.message)
    });
  }

  // Erreur Firebase
  if (err.code && err.code.startsWith('firebase')) {
    return res.status(500).json({
      success: false,
      message: 'Erreur de base de données',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }

  // Erreur FedaPay
  if (err.message && err.message.includes('FedaPay')) {
    return res.status(502).json({
      success: false,
      message: 'Erreur du service de paiement',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }

  // Erreur réseau/timeout
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
    return res.status(503).json({
      success: false,
      message: 'Service temporairement indisponible'
    });
  }

  // Erreur par défaut
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

/**
 * Middleware pour les routes non trouvées
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} non trouvée`
  });
};

/**
 * Wrapper pour les fonctions async
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};