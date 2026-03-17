import Database from 'better-sqlite3';

const db = new Database('mas_bosques.db', { verbose: console.log });

function initializeDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      fullName TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      emergencyContactName TEXT NOT NULL,
      emergencyContactPhone TEXT NOT NULL,
      bloodType TEXT NOT NULL,
      allergies TEXT,
      medicalConditions TEXT,
      termsAccepted INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        paramedicId TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        location TEXT,
        notes TEXT,
        FOREIGN KEY (userId) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS paramedic_scans (
      id TEXT PRIMARY KEY,
      paramedicId TEXT NOT NULL,
      userId TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);
  console.log('Database initialized.');
}

initializeDB();

export default db;
