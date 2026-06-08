import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let _db: FirebaseFirestore.Firestore | null = null;

function initialize() {
  if (_db) return;

  let serviceAccount: object;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    serviceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  } else {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
    const raw = fs.readFileSync(serviceAccountPath, 'utf8');
    serviceAccount = JSON.parse(raw);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
    });
    console.log('Initialized Firebase Admin and Firestore');
  }

  _db = admin.firestore();
}

// Lazy proxy: initialize() runs on first property access, not at module load time.
// If credentials are missing the error is thrown inside route try-catch blocks
// (returning JSON 500) instead of crashing the whole module (returning plain-text Vercel error).
const db = new Proxy({} as FirebaseFirestore.Firestore, {
  get(_target, prop) {
    initialize();
    const val = (_db as any)[prop];
    return typeof val === 'function' ? val.bind(_db) : val;
  },
});

export default db;
