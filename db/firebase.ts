import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let db: FirebaseFirestore.Firestore;

try {
  const serviceAccountPath = path.resolve(new URL('.', import.meta.url).pathname, 'firebase-service-account.json');
  const raw = fs.readFileSync(serviceAccountPath, 'utf8');
  const serviceAccount = JSON.parse(raw);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as any),
  });

  db = admin.firestore();
  console.log('Initialized Firebase Admin and Firestore');
} catch (err) {
  console.error('Failed to initialize Firebase Admin:', err);
  // Throw so the server startup fails visibly if Firebase isn't configured correctly
  throw err;
}

export default db;
