import express from 'express';
import db from './db/firebase.ts';
import crypto from 'crypto';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes will go here
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // User registration (stores user in Firestore)
  app.post('/api/register', async (req, res) => {
    const {
      fullName,
      email,
      phone,
      emergencyContactName,
      emergencyContactPhone,
      bloodType,
      allergies,
      medicalConditions,
      termsAccepted,
    } = req.body;

    if (!fullName || !email || !phone || !emergencyContactName || !emergencyContactPhone || !bloodType || !termsAccepted) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
      // Check if email already exists
      const existing = await db.collection('users').where('email', '==', email).limit(1).get();
      if (!existing.empty) {
        return res.status(409).json({ message: 'Email already registered' });
      }

      const id = crypto.randomUUID();
      const userDoc = db.collection('users').doc(id);
      await userDoc.set({
        id,
        fullName,
        fullNameLower: String(fullName).toLowerCase(),
        email,
        phone,
        emergencyContactName,
        emergencyContactPhone,
        bloodType,
        allergies: allergies || [],
        medicalConditions: medicalConditions || [],
        termsAccepted: !!termsAccepted,
        createdAt: new Date().toISOString(),
      });

      res.status(201).json({ message: 'User registered successfully', userId: id });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'An error occurred during registration' });
    }
  });

  // Get all users (for paramedic offline sync)
  app.get('/api/users', async (req, res) => {
    try {
      const snap = await db.collection('users').orderBy('createdAt', 'asc').get();
      const users: any[] = [];
      snap.forEach((doc) => users.push(doc.data()));
      res.json(users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // Get all incidents
  app.get('/api/incidents', async (req, res) => {
    try {
      const snap = await db.collection('incidents').orderBy('timestamp', 'desc').get();
      const incidents: any[] = [];
      snap.forEach((doc) => incidents.push(doc.data()));
      res.json(incidents);
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
      res.status(500).json({ message: 'Failed to fetch incidents' });
    }
  });

  // Create a new incident
  app.post('/api/incidents', async (req, res) => {
    const { userId, paramedicId, notes, location } = req.body;

    if (!userId || !paramedicId || !notes) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
      const id = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      await db.collection('incidents').doc(id).set({ id, userId, paramedicId, timestamp, location: location || null, notes });
      res.status(201).json({ message: 'Incident created successfully', incidentId: id });
    } catch (error) {
      console.error('Failed to create incident:', error);
      res.status(500).json({ message: 'Failed to create incident' });
    }
  });

  // Log a paramedic scan
  app.post('/api/scans', async (req, res) => {
    const { userId, paramedicId } = req.body;
    if (!userId || !paramedicId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    try {
      const id = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      await db.collection('paramedic_scans').doc(id).set({ id, paramedicId, userId, timestamp });
      res.status(201).json({ message: 'Scan logged successfully' });
    } catch (error) {
      console.error('Failed to log scan:', error);
      res.status(500).json({ message: 'Failed to log scan' });
    }
  });

  // Login
  app.post('/api/login', async (req, res) => {
    const { email, phone } = req.body;
    if (!email || !phone) {
      return res.status(400).json({ message: 'Correo y teléfono son requeridos' });
    }
    try {
      const snap = await db.collection('users').where('email', '==', email).where('phone', '==', phone).limit(1).get();
      if (!snap.empty) {
        const user = snap.docs[0].data();
        res.json(user);
      } else {
        res.status(401).json({ message: 'Credenciales inválidas' });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Error en el inicio de sesión' });
    }
  });

  app.get('/api/users/find', async (req, res) => {
    const { fullName, phone } = req.query as { fullName?: string; phone?: string };

    if (!fullName || !phone) {
      return res.status(400).json({ message: 'Nombre y teléfono son requeridos' });
    }

    try {
      const nameLower = String(fullName).toLowerCase();
      const snap = await db.collection('users').where('fullNameLower', '==', nameLower).where('phone', '==', phone).limit(1).get();
      if (!snap.empty) {
        res.json({ userId: snap.docs[0].data().id });
      } else {
        res.status(404).json({ message: 'Usuario no encontrado' });
      }
    } catch (error) {
      console.error('Failed to find user:', error);
      res.status(500).json({ message: 'Error al buscar usuario' });
    }
  });

  // Notification Management
  app.get('/api/notifications', async (req, res) => {
    try {
      const snap = await db.collection('notifications').orderBy('createdAt', 'desc').get();
      const notifications: any[] = [];
      snap.forEach((doc) => notifications.push(doc.data()));
      res.json(notifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      res.status(500).json({ message: 'Error al obtener notificaciones' });
    }
  });

  app.post('/api/notifications', async (req, res) => {
    const { title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ message: 'Título y mensaje son requeridos' });
    }
    try {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      await db.collection('notifications').doc(id).set({ id, title, message, createdAt });
      res.status(201).json({ message: 'Notificación creada con éxito' });
    } catch (error) {
      console.error('Failed to create notification:', error);
      res.status(500).json({ message: 'Error al crear notificación' });
    }
  });

  app.get('/api/analytics/scans', async (req, res) => {
    try {
      const snap = await db.collection('paramedic_scans').get();
      const counts: Record<string, number> = {};
      snap.forEach((doc) => {
        const data = doc.data();
        counts[data.paramedicId] = (counts[data.paramedicId] || 0) + 1;
      });
      const analytics = Object.entries(counts).map(([paramedicId, scanCount]) => ({ paramedicId, scanCount })).sort((a, b) => b.scanCount - a.scanCount);
      res.json(analytics);
    } catch (error) {
      console.error('Failed to fetch scan analytics:', error);
      res.status(500).json({ message: 'Failed to fetch scan analytics' });
    }
  });


  // API routes should be defined before the Vite middleware
  // This ensures they are not overridden by Vite's handling


  // All API routes are already defined before this block, so no changes are needed here.

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the built static files
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    app.use(express.static(path.resolve(__dirname, 'dist')));

    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

