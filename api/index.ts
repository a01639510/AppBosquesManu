import express from 'express';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

const app = express();
app.use(express.json());

function db() {
  if (!getApps().length) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.FIREBASE_PROJECT_ID) {
      throw new Error(
        'Firebase credentials not configured. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.',
      );
    }
    const credential = process.env.FIREBASE_SERVICE_ACCOUNT
      ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
      : cert({
          projectId: process.env.FIREBASE_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
          privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        });
    initializeApp({ credential });
  }
  return getFirestore();
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/register', async (req, res) => {
  const { fullName, email, phone, emergencyContactName, emergencyContactPhone, bloodType, allergies, medicalConditions, termsAccepted } = req.body;
  if (!fullName || !email || !phone || !emergencyContactName || !emergencyContactPhone || !bloodType || !termsAccepted) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    const existing = await db().collection('users').where('email', '==', email).limit(1).get();
    if (!existing.empty) return res.status(409).json({ message: 'Email already registered' });
    const id = crypto.randomUUID();
    await db().collection('users').doc(id).set({
      id, fullName, fullNameLower: String(fullName).toLowerCase(), email, phone,
      emergencyContactName, emergencyContactPhone, bloodType,
      allergies: allergies || [], medicalConditions: medicalConditions || [],
      termsAccepted: !!termsAccepted, createdAt: new Date().toISOString(),
    });
    return res.status(201).json({ message: 'User registered successfully', userId: id });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ message: 'An error occurred during registration' });
  }
});

app.get('/api/users', async (_req, res) => {
  try {
    const snap = await db().collection('users').orderBy('createdAt', 'asc').get();
    const users: any[] = [];
    snap.forEach((doc) => users.push(doc.data()));
    return res.json(users);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return res.status(500).json({ message: 'Failed to fetch users' });
  }
});

app.get('/api/users/find', async (req, res) => {
  const { fullName, phone } = req.query as { fullName?: string; phone?: string };
  if (!fullName || !phone) return res.status(400).json({ message: 'Nombre y teléfono son requeridos' });
  try {
    const snap = await db().collection('users').where('fullNameLower', '==', String(fullName).toLowerCase()).where('phone', '==', phone).limit(1).get();
    if (!snap.empty) return res.json({ userId: snap.docs[0].data().id });
    return res.status(404).json({ message: 'Usuario no encontrado' });
  } catch (error) {
    console.error('Failed to find user:', error);
    return res.status(500).json({ message: 'Error al buscar usuario' });
  }
});

app.get('/api/incidents', async (_req, res) => {
  try {
    const snap = await db().collection('incidents').orderBy('timestamp', 'desc').get();
    const incidents: any[] = [];
    snap.forEach((doc) => incidents.push(doc.data()));
    return res.json(incidents);
  } catch (error) {
    console.error('Failed to fetch incidents:', error);
    return res.status(500).json({ message: 'Failed to fetch incidents' });
  }
});

app.post('/api/incidents', async (req, res) => {
  const { userId, paramedicId, notes, location } = req.body;
  if (!userId || !paramedicId || !notes) return res.status(400).json({ message: 'Missing required fields' });
  try {
    const id = crypto.randomUUID();
    await db().collection('incidents').doc(id).set({ id, userId, paramedicId, timestamp: new Date().toISOString(), location: location || null, notes });
    return res.status(201).json({ message: 'Incident created successfully', incidentId: id });
  } catch (error) {
    console.error('Failed to create incident:', error);
    return res.status(500).json({ message: 'Failed to create incident' });
  }
});

app.post('/api/scans', async (req, res) => {
  const { userId, paramedicId } = req.body;
  if (!userId || !paramedicId) return res.status(400).json({ message: 'Missing required fields' });
  try {
    const id = crypto.randomUUID();
    await db().collection('paramedic_scans').doc(id).set({ id, paramedicId, userId, timestamp: new Date().toISOString() });
    return res.status(201).json({ message: 'Scan logged successfully' });
  } catch (error) {
    console.error('Failed to log scan:', error);
    return res.status(500).json({ message: 'Failed to log scan' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, phone } = req.body;
  if (!email || !phone) return res.status(400).json({ message: 'Correo y teléfono son requeridos' });
  try {
    const snap = await db().collection('users').where('email', '==', email).where('phone', '==', phone).limit(1).get();
    if (!snap.empty) return res.json(snap.docs[0].data());
    return res.status(401).json({ message: 'Credenciales inválidas' });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Error en el inicio de sesión' });
  }
});

app.get('/api/notifications', async (_req, res) => {
  try {
    const snap = await db().collection('notifications').orderBy('createdAt', 'desc').get();
    const notifications: any[] = [];
    snap.forEach((doc) => notifications.push(doc.data()));
    return res.json(notifications);
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return res.status(500).json({ message: 'Error al obtener notificaciones' });
  }
});

app.post('/api/notifications', async (req, res) => {
  const { title, message } = req.body;
  if (!title || !message) return res.status(400).json({ message: 'Título y mensaje son requeridos' });
  try {
    const id = crypto.randomUUID();
    await db().collection('notifications').doc(id).set({ id, title, message, createdAt: new Date().toISOString() });
    return res.status(201).json({ message: 'Notificación creada con éxito' });
  } catch (error) {
    console.error('Failed to create notification:', error);
    return res.status(500).json({ message: 'Error al crear notificación' });
  }
});

app.get('/api/analytics/scans', async (_req, res) => {
  try {
    const snap = await db().collection('paramedic_scans').get();
    const counts: Record<string, number> = {};
    snap.forEach((doc) => {
      const data = doc.data();
      counts[data.paramedicId] = (counts[data.paramedicId] || 0) + 1;
    });
    const analytics = Object.entries(counts)
      .map(([paramedicId, scanCount]) => ({ paramedicId, scanCount }))
      .sort((a, b) => b.scanCount - a.scanCount);
    return res.json(analytics);
  } catch (error) {
    console.error('Failed to fetch scan analytics:', error);
    return res.status(500).json({ message: 'Failed to fetch scan analytics' });
  }
});

export default app;
