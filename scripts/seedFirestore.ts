import db from '../db/firebase.ts';
import crypto from 'crypto';

async function seed() {
  try {
    const users = [
      {
        id: crypto.randomUUID(),
        fullName: 'María López',
        email: 'maria.lopez@example.com',
        phone: '+5491123456789',
        emergencyContactName: 'Juan López',
        emergencyContactPhone: '+5491198765432',
        bloodType: 'O+',
        allergies: ['Penicillin'],
        medicalConditions: ['Asthma'],
        termsAccepted: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        fullName: 'Carlos Pérez',
        email: 'carlos.perez@example.com',
        phone: '+5491133334444',
        emergencyContactName: 'Ana Pérez',
        emergencyContactPhone: '+5491144443333',
        bloodType: 'A-',
        allergies: [],
        medicalConditions: [],
        termsAccepted: true,
        createdAt: new Date().toISOString(),
      },
    ];

    for (const u of users) {
      await db.collection('users').doc(u.id).set({ ...u, fullNameLower: String(u.fullName).toLowerCase() });
    }

    const paramedicId = crypto.randomUUID();

    const incidents = [
      {
        id: crypto.randomUUID(),
        userId: users[0].id,
        paramedicId,
        timestamp: new Date().toISOString(),
        location: 'Parque Central',
        notes: 'Paciente con dificultad respiratoria',
      },
    ];

    for (const inc of incidents) {
      await db.collection('incidents').doc(inc.id).set(inc);
    }

    const scans = [
      { id: crypto.randomUUID(), paramedicId, userId: users[0].id, timestamp: new Date().toISOString() },
      { id: crypto.randomUUID(), paramedicId, userId: users[1].id, timestamp: new Date().toISOString() },
    ];
    for (const s of scans) {
      await db.collection('paramedic_scans').doc(s.id).set(s);
    }

    const notifications = [
      { id: crypto.randomUUID(), title: 'Prueba', message: 'Notificación de prueba', createdAt: new Date().toISOString() },
    ];
    for (const n of notifications) {
      await db.collection('notifications').doc(n.id).set(n);
    }

    console.log('Seeding complete:', {
      users: users.length,
      incidents: incidents.length,
      scans: scans.length,
      notifications: notifications.length,
    });
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
}

seed();
