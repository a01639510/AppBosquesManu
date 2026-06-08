import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// ─── Firestore REST client ────────────────────────────────────────────────────
// Uses only built-in Node.js modules (crypto + fetch).
// Avoids firebase-admin whose gRPC/proto loader breaks in Vercel's esbuild bundle.

interface ServiceAccount { project_id: string; client_email: string; private_key: string; }

function getServiceAccount(): ServiceAccount {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    return {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }
  throw new Error('Firebase credentials not configured. Set FIREBASE_SERVICE_ACCOUNT env var.');
}

let _token: { value: string; exp: number } | null = null;

async function getToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (_token && _token.exp > now + 60) return _token.value;

  const sa = getServiceAccount();
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })).toString('base64url');
  const signing = `${header}.${claims}`;
  const sig = crypto.createSign('RSA-SHA256').update(signing).sign(sa.private_key, 'base64url');
  const jwt = `${signing}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`OAuth2 error: ${await res.text()}`);
  const data = await res.json() as any;
  _token = { value: data.access_token, exp: now + data.expires_in };
  return _token.value;
}

function base(projectId: string) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

// Firestore value ↔ JS value converters
function fromVal(v: any): any {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(fromVal);
  if (v.mapValue) return fromFields(v.mapValue.fields || {});
  return null;
}
function fromFields(f: Record<string, any>) {
  const r: Record<string, any> = {};
  for (const [k, v] of Object.entries(f)) r[k] = fromVal(v);
  return r;
}
function toVal(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toVal) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  return { stringValue: String(v) };
}
function toFields(o: Record<string, any>) {
  const r: Record<string, any> = {};
  for (const [k, v] of Object.entries(o)) r[k] = toVal(v);
  return r;
}

// Set (create/overwrite) a document
async function fsSet(col: string, id: string, data: Record<string, any>) {
  const [token, sa] = await Promise.all([getToken(), getServiceAccount()]);
  const res = await fetch(`${base(sa.project_id)}/${col}/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) }),
  });
  if (!res.ok) throw new Error(`Firestore set error: ${await res.text()}`);
}

// Run a structured query
async function fsQuery(
  col: string,
  conditions: Array<{ field: string; op: string; value: any }>,
  orderBy?: { field: string; dir?: 'ASCENDING' | 'DESCENDING' },
  limit?: number,
): Promise<Record<string, any>[]> {
  const [token, sa] = await Promise.all([getToken(), getServiceAccount()]);

  const where = conditions.length === 0 ? undefined
    : conditions.length === 1
    ? { fieldFilter: { field: { fieldPath: conditions[0].field }, op: conditions[0].op, value: toVal(conditions[0].value) } }
    : { compositeFilter: { op: 'AND', filters: conditions.map(c => ({ fieldFilter: { field: { fieldPath: c.field }, op: c.op, value: toVal(c.value) } })) } };

  const query: any = { structuredQuery: { from: [{ collectionId: col }] } };
  if (where) query.structuredQuery.where = where;
  if (orderBy) query.structuredQuery.orderBy = [{ field: { fieldPath: orderBy.field }, direction: orderBy.dir ?? 'ASCENDING' }];
  if (limit) query.structuredQuery.limit = limit;

  const res = await fetch(`${base(sa.project_id)}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });
  if (!res.ok) throw new Error(`Firestore query error: ${await res.text()}`);
  const rows = await res.json() as any[];
  return rows.filter((r: any) => r.document).map((r: any) => fromFields(r.document.fields || {}));
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/register', async (req, res) => {
  const { fullName, email, phone, emergencyContactName, emergencyContactPhone, bloodType, allergies, medicalConditions, termsAccepted } = req.body;
  if (!fullName || !email || !phone || !emergencyContactName || !emergencyContactPhone || !bloodType || !termsAccepted) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    const existing = await fsQuery('users', [{ field: 'email', op: 'EQUAL', value: email }], undefined, 1);
    if (existing.length > 0) return res.status(409).json({ message: 'Email already registered' });
    const id = crypto.randomUUID();
    await fsSet('users', id, {
      id, fullName, fullNameLower: String(fullName).toLowerCase(), email, phone,
      emergencyContactName, emergencyContactPhone, bloodType,
      allergies: allergies || [], medicalConditions: medicalConditions || [],
      termsAccepted: !!termsAccepted, createdAt: new Date().toISOString(),
    });
    return res.status(201).json({ message: 'User registered successfully', userId: id });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ message: 'An error occurred during registration' });
  }
});

app.get('/api/users', async (_req, res) => {
  try {
    const users = await fsQuery('users', [], { field: 'createdAt', dir: 'ASCENDING' });
    return res.json(users);
  } catch (err) {
    console.error('Failed to fetch users:', err);
    return res.status(500).json({ message: 'Failed to fetch users' });
  }
});

app.get('/api/users/find', async (req, res) => {
  const { fullName, phone } = req.query as { fullName?: string; phone?: string };
  if (!fullName || !phone) return res.status(400).json({ message: 'Nombre y teléfono son requeridos' });
  try {
    const rows = await fsQuery('users', [
      { field: 'fullNameLower', op: 'EQUAL', value: String(fullName).toLowerCase() },
      { field: 'phone', op: 'EQUAL', value: phone },
    ], undefined, 1);
    if (rows.length > 0) return res.json({ userId: rows[0].id });
    return res.status(404).json({ message: 'Usuario no encontrado' });
  } catch (err) {
    console.error('Failed to find user:', err);
    return res.status(500).json({ message: 'Error al buscar usuario' });
  }
});

app.get('/api/incidents', async (_req, res) => {
  try {
    const incidents = await fsQuery('incidents', [], { field: 'timestamp', dir: 'DESCENDING' });
    return res.json(incidents);
  } catch (err) {
    console.error('Failed to fetch incidents:', err);
    return res.status(500).json({ message: 'Failed to fetch incidents' });
  }
});

app.post('/api/incidents', async (req, res) => {
  const { userId, paramedicId, notes, location } = req.body;
  if (!userId || !paramedicId || !notes) return res.status(400).json({ message: 'Missing required fields' });
  try {
    const id = crypto.randomUUID();
    await fsSet('incidents', id, { id, userId, paramedicId, timestamp: new Date().toISOString(), location: location || null, notes });
    return res.status(201).json({ message: 'Incident created successfully', incidentId: id });
  } catch (err) {
    console.error('Failed to create incident:', err);
    return res.status(500).json({ message: 'Failed to create incident' });
  }
});

app.post('/api/scans', async (req, res) => {
  const { userId, paramedicId } = req.body;
  if (!userId || !paramedicId) return res.status(400).json({ message: 'Missing required fields' });
  try {
    const id = crypto.randomUUID();
    await fsSet('paramedic_scans', id, { id, paramedicId, userId, timestamp: new Date().toISOString() });
    return res.status(201).json({ message: 'Scan logged successfully' });
  } catch (err) {
    console.error('Failed to log scan:', err);
    return res.status(500).json({ message: 'Failed to log scan' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, phone } = req.body;
  if (!email || !phone) return res.status(400).json({ message: 'Correo y teléfono son requeridos' });
  try {
    const rows = await fsQuery('users', [
      { field: 'email', op: 'EQUAL', value: email },
      { field: 'phone', op: 'EQUAL', value: phone },
    ], undefined, 1);
    if (rows.length > 0) return res.json(rows[0]);
    return res.status(401).json({ message: 'Credenciales inválidas' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Error en el inicio de sesión' });
  }
});

app.get('/api/notifications', async (_req, res) => {
  try {
    const notifications = await fsQuery('notifications', [], { field: 'createdAt', dir: 'DESCENDING' });
    return res.json(notifications);
  } catch (err) {
    console.error('Failed to fetch notifications:', err);
    return res.status(500).json({ message: 'Error al obtener notificaciones' });
  }
});

app.post('/api/notifications', async (req, res) => {
  const { title, message } = req.body;
  if (!title || !message) return res.status(400).json({ message: 'Título y mensaje son requeridos' });
  try {
    const id = crypto.randomUUID();
    await fsSet('notifications', id, { id, title, message, createdAt: new Date().toISOString() });
    return res.status(201).json({ message: 'Notificación creada con éxito' });
  } catch (err) {
    console.error('Failed to create notification:', err);
    return res.status(500).json({ message: 'Error al crear notificación' });
  }
});

app.get('/api/analytics/scans', async (_req, res) => {
  try {
    const scans = await fsQuery('paramedic_scans', []);
    const counts: Record<string, number> = {};
    for (const s of scans) counts[s.paramedicId] = (counts[s.paramedicId] || 0) + 1;
    const analytics = Object.entries(counts)
      .map(([paramedicId, scanCount]) => ({ paramedicId, scanCount }))
      .sort((a, b) => b.scanCount - a.scanCount);
    return res.json(analytics);
  } catch (err) {
    console.error('Failed to fetch scan analytics:', err);
    return res.status(500).json({ message: 'Failed to fetch scan analytics' });
  }
});

export default app;
