import express from 'express';
import db from './db/database.ts';
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

  // User registration
  app.post('/api/register', (req, res) => {
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

    // Basic validation
    if (!fullName || !email || !phone || !emergencyContactName || !emergencyContactPhone || !bloodType || !termsAccepted) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
      const id = crypto.randomUUID();
      const stmt = db.prepare(`
        INSERT INTO users (id, fullName, email, phone, emergencyContactName, emergencyContactPhone, bloodType, allergies, medicalConditions, termsAccepted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        id,
        fullName,
        email,
        phone,
        emergencyContactName,
        emergencyContactPhone,
        bloodType,
        JSON.stringify(allergies || []),
        JSON.stringify(medicalConditions || []),
        termsAccepted ? 1 : 0
      );

      res.status(201).json({ message: 'User registered successfully', userId: id });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ message: 'Email already registered' });
      }
      console.error('Registration error:', error);
      res.status(500).json({ message: 'An error occurred during registration' });
    }
  });

  // Get all users (for paramedic offline sync)
  app.get('/api/users', (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM users');
      const users = stmt.all();
      res.json(users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // Get all incidents
  app.get('/api/incidents', (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM incidents');
      const incidents = stmt.all();
      res.json(incidents);
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
      res.status(500).json({ message: 'Failed to fetch incidents' });
    }
  });

  // Create a new incident
  app.post('/api/incidents', (req, res) => {
    const { userId, paramedicId, notes, location } = req.body;

    if (!userId || !paramedicId || !notes) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();

        const stmt = db.prepare(`
            INSERT INTO incidents (id, userId, paramedicId, timestamp, location, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(id, userId, paramedicId, timestamp, location || null, notes);

        res.status(201).json({ message: 'Incident created successfully', incidentId: id });
    } catch (error) {
        console.error('Failed to create incident:', error);
        res.status(500).json({ message: 'Failed to create incident' });
    }
  });

  // Log a paramedic scan
  app.post('/api/scans', (req, res) => {
    const { userId, paramedicId } = req.body;
    if (!userId || !paramedicId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    try {
      const id = crypto.randomUUID();
      const timestamp = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT INTO paramedic_scans (id, paramedicId, userId, timestamp)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(id, paramedicId, userId, timestamp);
      res.status(201).json({ message: 'Scan logged successfully' });
    } catch (error) {
      console.error('Failed to log scan:', error);
      res.status(500).json({ message: 'Failed to log scan' });
    }
  });

  // Get scan analytics
  // Find user by name and phone (case-insensitive, accent-insensitive)
  app.post('/api/login', (req, res) => {
    const { email, phone } = req.body;
    if (!email || !phone) {
      return res.status(400).json({ message: 'Correo y teléfono son requeridos' });
    }
    try {
      const stmt = db.prepare('SELECT * FROM users WHERE email = ? AND phone = ?');
      const user = stmt.get(email, phone);
      if (user) {
        res.json(user);
      } else {
        res.status(401).json({ message: 'Credenciales inválidas' });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Error en el inicio de sesión' });
    }
  });

  app.get('/api/users/find', (req, res) => {
    const { fullName, phone } = req.query;

    if (!fullName || !phone) {
      return res.status(400).json({ message: 'Nombre y teléfono son requeridos' });
    }

    try {
      // This is a simplified search. A real-world app should use a more robust search like FTS5 or a proper database search function.
      const stmt = db.prepare(`
        SELECT id FROM users WHERE REPLACE(LOWER(fullName), 'á', 'a') = REPLACE(LOWER(?), 'á', 'a') AND phone = ?
      `);
      const user = stmt.get(String(fullName).toLowerCase(), phone);

      if (user) {
        res.json({ userId: user.id });
      } else {
        res.status(404).json({ message: 'Usuario no encontrado' });
      }
    } catch (error) {
      console.error('Failed to find user:', error);
      res.status(500).json({ message: 'Error al buscar usuario' });
    }
  });

  // Notification Management
  app.get('/api/notifications', (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM notifications ORDER BY createdAt DESC');
      const notifications = stmt.all();
      res.json(notifications);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      res.status(500).json({ message: 'Error al obtener notificaciones' });
    }
  });

  app.post('/api/notifications', (req, res) => {
    const { title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ message: 'Título y mensaje son requeridos' });
    }
    try {
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT INTO notifications (id, title, message, createdAt)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(id, title, message, createdAt);
      res.status(201).json({ message: 'Notificación creada con éxito' });
    } catch (error) {
      console.error('Failed to create notification:', error);
      res.status(500).json({ message: 'Error al crear notificación' });
    }
  });

  app.get('/api/analytics/scans', (req, res) => {
    try {
      const stmt = db.prepare(`
        SELECT paramedicId, COUNT(id) as scanCount
        FROM paramedic_scans
        GROUP BY paramedicId
        ORDER BY scanCount DESC
      `);
      const analytics = stmt.all();
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

