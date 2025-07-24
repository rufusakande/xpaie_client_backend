// config/firebase.js
const admin = require('firebase-admin');

// Initialiser Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'xpaie-2b00a'
});

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };