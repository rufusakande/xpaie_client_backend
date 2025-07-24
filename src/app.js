// app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Charger les variables d'environnement
require('dotenv').config();

// Import des routes
const depositRoutes = require('./routes/depositRoutes');
const callbackRoutes = require('./routes/callbackRoutes');

// Initialiser l'application Express
const app = express();

// Middleware de sécurité
app.use(helmet());

// Configuration CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logger pour le développement
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Middleware pour parser le JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware pour servir les fichiers statiques (si nécessaire)
app.use('/public', express.static(path.join(__dirname, 'public')));

// Route de base pour vérifier que l'API fonctionne
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Bienvenue sur XPaie API',
    version: process.env.API_VERSION || 'v1',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Route de santé pour les contrôles
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Routes de l'API
app.use('/api/deposits', depositRoutes);
app.use('/api/payments', callbackRoutes);

// Middleware pour gérer les routes non trouvées
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} non trouvée`,
    availableRoutes: [
      'GET /',
      'GET /health',
      'POST /api/deposits/create',
      'GET /api/deposits/user/:userId',
      'GET /api/deposits/:transactionId',
      'GET /api/payments/callback',
      'POST /api/payments/webhook'
    ]
  });
});

// Middleware global de gestion des erreurs
app.use((error, req, res, next) => {
  console.error('Erreur non gérée:', error);
  
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Erreur interne du serveur';
  
  res.status(statusCode).json({
    success: false,
    message: message,
    error: process.env.NODE_ENV === 'development' ? {
      stack: error.stack,
      details: error
    } : undefined,
    timestamp: new Date().toISOString()
  });
});

// Gestion des processus non capturés
process.on('uncaughtException', (error) => {
  console.error('Exception non capturée:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesse rejetée non gérée:', reason);
  process.exit(1);
});

// Démarrer le serveur
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Serveur XPaie démarré sur le port ${PORT}`);
  console.log(`📱 Environnement: ${process.env.NODE_ENV}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`💳 FedaPay: Mode ${process.env.FEDAPAY_SECRET_KEY?.includes('sandbox') ? 'Sandbox' : 'Production'}`);
});

// Gestion de l'arrêt gracieux
process.on('SIGTERM', () => {
  console.log('SIGTERM reçu, arrêt du serveur...');
  server.close(() => {
    console.log('Serveur arrêté');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT reçu, arrêt du serveur...');
  server.close(() => {
    console.log('Serveur arrêté');
    process.exit(0);
  });
});

module.exports = app;