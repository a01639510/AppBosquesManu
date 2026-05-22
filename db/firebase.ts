import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: FirebaseFirestore.Firestore;

try {
  const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
  const raw = fs.readFileSync(serviceAccountPath, 'utf8');
  const serviceAccount = JSON.parse(raw);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as any),
  });

  db = admin.firestore();
  console.log('Initialized Firebase Admin and Firestore');
} catch (err) {
  console.error('Failed to initialize Firebase Admin:', err);
  throw err;
}

export default db;
