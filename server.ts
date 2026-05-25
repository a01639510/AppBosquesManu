import express from 'express';
import dotenv from 'dotenv';
import db from './db/firebase.ts';
import crypto from 'crypto';
import path from 'path';
import { createServer as createViteServer } from 'vite';

dotenv.config();

type UserRole = 'visitor' | 'admin' | 'paramedic';
type ChallengePurpose = 'login' | 'register';

const CHALLENGE_EXPIRATION_MINUTES = 10;

function normalizePhoneNumber(phone: string) {
  const clean = String(phone || '').trim();

  if (clean.startsWith('+')) {
    return `+${clean.slice(1).replace(/\D/g, '')}`;
  }

  const digits = clean.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+52${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('52')) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

function maskPhone(phone: string) {
  if (!phone || phone.length < 6) return phone;
  return `${phone.slice(0, 3)}******${phone.slice(-2)}`;
}

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !verifyServiceSid) {
    throw new Error('Twilio no está configurado. Faltan TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN o TWILIO_VERIFY_SERVICE_SID.');
  }

  return { accountSid, authToken, verifyServiceSid };
}

async function twilioVerifyRequest(pathname: string, params: Record<string, string>) {
  const { accountSid, authToken } = getTwilioConfig();
  const body = new URLSearchParams(params);
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const response = await fetch(`https://verify.twilio.com/v2${pathname}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Twilio error:', data);
    throw new Error(data.message || 'Error al comunicarse con Twilio');
  }

  return data;
}

async function startSmsVerification(phone: string) {
  const { verifyServiceSid } = getTwilioConfig();

  return twilioVerifyRequest(`/Services/${verifyServiceSid}/Verifications`, {
    To: phone,
    Channel: 'sms',
    Locale: 'es',
  });
}

async function checkSmsVerification(phone: string, code: string) {
  const { verifyServiceSid } = getTwilioConfig();

  const data = await twilioVerifyRequest(`/Services/${verifyServiceSid}/VerificationCheck`, {
    To: phone,
    Code: String(code).trim(),
  });

  return data.status === 'approved';
}

async function createTwoFactorChallenge(params: {
  purpose: ChallengePurpose;
  role: UserRole;
  phone: string;
  userId?: string;
  pendingUserData?: any;
}) {
  const challengeId = crypto.randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CHALLENGE_EXPIRATION_MINUTES * 60 * 1000).toISOString();

  await db.collection('two_factor_challenges').doc(challengeId).set({
    id: challengeId,
    purpose: params.purpose,
    role: params.role,
    phone: params.phone,
    userId: params.userId || null,
    pendingUserData: params.pendingUserData || null,
    used: false,
    createdAt: now.toISOString(),
    expiresAt,
  });

  return challengeId;
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() < Date.now();
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // =========================
  // LOGIN 2FA - START
  // =========================
  app.post('/api/auth/start-2fa', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario/correo y contraseña/teléfono son requeridos' });
    }

    try {
      let role: UserRole | null = null;
      let phoneE164 = '';
      let userId: string | undefined;

      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
      const adminPhone = process.env.ADMIN_2FA_PHONE;

      const paramedicUsername = process.env.PARAMEDIC_USERNAME || 'paramedic';
      const paramedicPassword = process.env.PARAMEDIC_PASSWORD || 'paramedic';
      const paramedicPhone = process.env.PARAMEDIC_2FA_PHONE;

      if (username === adminUsername && password === adminPassword) {
        if (!adminPhone) {
          return res.status(500).json({ message: 'Falta configurar ADMIN_2FA_PHONE en el servidor' });
        }

        role = 'admin';
        phoneE164 = normalizePhoneNumber(adminPhone);
      } else if (username === paramedicUsername && password === paramedicPassword) {
        if (!paramedicPhone) {
          return res.status(500).json({ message: 'Falta configurar PARAMEDIC_2FA_PHONE en el servidor' });
        }

        role = 'paramedic';
        phoneE164 = normalizePhoneNumber(paramedicPhone);
      } else {
        // Visitante: username = correo, password = teléfono
        const snap = await db.collection('users').where('email', '==', username).limit(5).get();

        let matchedUser: any = null;

        snap.forEach((doc) => {
          const user = doc.data();
          const storedPhone = String(user.phone || '');
          const storedPhoneE164 = String(user.phoneE164 || normalizePhoneNumber(storedPhone));
          const inputPhoneE164 = normalizePhoneNumber(password);

          if (storedPhone === password || storedPhoneE164 === inputPhoneE164) {
            matchedUser = user;
          }
        });

        if (!matchedUser) {
          return res.status(401).json({ message: 'Credenciales inválidas' });
        }

        role = 'visitor';
        userId = matchedUser.id;
        phoneE164 = matchedUser.phoneE164 || normalizePhoneNumber(matchedUser.phone);
      }

      await startSmsVerification(phoneE164);

      const challengeId = await createTwoFactorChallenge({
        purpose: 'login',
        role,
        phone: phoneE164,
        userId,
      });

      res.json({
        message: 'Código enviado por SMS',
        challengeId,
        role,
        maskedPhone: maskPhone(phoneE164),
      });
    } catch (error) {
      console.error('Error al iniciar 2FA:', error);
      res.status(500).json({ message: 'No se pudo enviar el código de verificación' });
    }
  });

  // =========================
  // LOGIN 2FA - VERIFY
  // =========================
  app.post('/api/auth/verify-2fa', async (req, res) => {
    const { challengeId, code } = req.body;

    if (!challengeId || !code) {
      return res.status(400).json({ message: 'Challenge ID y código son requeridos' });
    }

    try {
      const challengeRef = db.collection('two_factor_challenges').doc(challengeId);
      const challengeDoc = await challengeRef.get();

      if (!challengeDoc.exists) {
        return res.status(404).json({ message: 'Verificación no encontrada' });
      }

      const challenge = challengeDoc.data() as any;

      if (challenge.used) {
        return res.status(400).json({ message: 'Este código ya fue utilizado' });
      }

      if (challenge.purpose !== 'login') {
        return res.status(400).json({ message: 'Tipo de verificación inválido' });
      }

      if (isExpired(challenge.expiresAt)) {
        return res.status(400).json({ message: 'El código expiró. Solicita uno nuevo.' });
      }

      const approved = await checkSmsVerification(challenge.phone, code);

      if (!approved) {
        return res.status(401).json({ message: 'Código incorrecto' });
      }

      await challengeRef.update({
        used: true,
        usedAt: new Date().toISOString(),
      });

      if (challenge.role === 'visitor') {
        const userDoc = await db.collection('users').doc(challenge.userId).get();

        if (!userDoc.exists) {
          return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        return res.json({
          message: 'Verificación exitosa',
          role: 'visitor',
          user: userDoc.data(),
        });
      }

      res.json({
        message: 'Verificación exitosa',
        role: challenge.role,
      });
    } catch (error) {
      console.error('Error al verificar 2FA:', error);
      res.status(500).json({ message: 'No se pudo verificar el código' });
    }
  });

  // =========================
  // REGISTRO VISITANTE 2FA - START
  // =========================
  app.post('/api/register/start', async (req, res) => {
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
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }

    try {
      const existing = await db.collection('users').where('email', '==', email).limit(1).get();

      if (!existing.empty) {
        return res.status(409).json({ message: 'Este correo ya está registrado' });
      }

      const phoneE164 = normalizePhoneNumber(phone);

      const pendingUserData = {
        fullName,
        fullNameLower: String(fullName).toLowerCase(),
        email,
        phone,
        phoneE164,
        emergencyContactName,
        emergencyContactPhone,
        bloodType,
        allergies: allergies || [],
        medicalConditions: medicalConditions || [],
        termsAccepted: !!termsAccepted,
      };

      await startSmsVerification(phoneE164);

      const challengeId = await createTwoFactorChallenge({
        purpose: 'register',
        role: 'visitor',
        phone: phoneE164,
        pendingUserData,
      });

      res.json({
        message: 'Código enviado por SMS',
        challengeId,
        maskedPhone: maskPhone(phoneE164),
      });
    } catch (error) {
      console.error('Error al iniciar registro con 2FA:', error);
      res.status(500).json({ message: 'No se pudo enviar el código de verificación' });
    }
  });

  // =========================
  // REGISTRO VISITANTE 2FA - VERIFY
  // =========================
  app.post('/api/register/verify', async (req, res) => {
    const { challengeId, code } = req.body;

    if (!challengeId || !code) {
      return res.status(400).json({ message: 'Challenge ID y código son requeridos' });
    }

    try {
      const challengeRef = db.collection('two_factor_challenges').doc(challengeId);
      const challengeDoc = await challengeRef.get();

      if (!challengeDoc.exists) {
        return res.status(404).json({ message: 'Verificación no encontrada' });
      }

      const challenge = challengeDoc.data() as any;

      if (challenge.used) {
        return res.status(400).json({ message: 'Este código ya fue utilizado' });
      }

      if (challenge.purpose !== 'register') {
        return res.status(400).json({ message: 'Tipo de verificación inválido' });
      }

      if (isExpired(challenge.expiresAt)) {
        return res.status(400).json({ message: 'El código expiró. Registra tus datos nuevamente.' });
      }

      const approved = await checkSmsVerification(challenge.phone, code);

      if (!approved) {
        return res.status(401).json({ message: 'Código incorrecto' });
      }

      const pendingUserData = challenge.pendingUserData;

      const existing = await db.collection('users').where('email', '==', pendingUserData.email).limit(1).get();

      if (!existing.empty) {
        return res.status(409).json({ message: 'Este correo ya está registrado' });
      }

      const id = crypto.randomUUID();

      await db.collection('users').doc(id).set({
        id,
        ...pendingUserData,
        createdAt: new Date().toISOString(),
        phoneVerified: true,
      });

      await challengeRef.update({
        used: true,
        usedAt: new Date().toISOString(),
      });

      res.status(201).json({
        message: 'Usuario registrado correctamente',
        userId: id,
      });
    } catch (error) {
      console.error('Error al verificar registro:', error);
      res.status(500).json({ message: 'No se pudo completar el registro' });
    }
  });

  // Endpoint anterior bloqueado para evitar registro sin SMS
  app.post('/api/register', async (req, res) => {
    res.status(410).json({ message: 'Este registro ahora requiere verificación SMS. Usa /api/register/start.' });
  });

  // Endpoint anterior bloqueado para evitar login sin SMS
  app.post('/api/login', async (req, res) => {
    res.status(410).json({ message: 'Este inicio de sesión ahora requiere verificación SMS. Usa /api/auth/start-2fa.' });
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

      const analytics = Object.entries(counts)
        .map(([paramedicId, scanCount]) => ({ paramedicId, scanCount }))
        .sort((a, b) => b.scanCount - a.scanCount);

      res.json(analytics);
    } catch (error) {
      console.error('Failed to fetch scan analytics:', error);
      res.status(500).json({ message: 'Failed to fetch scan analytics' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
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
