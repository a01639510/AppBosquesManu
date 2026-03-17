import { openDB } from 'idb';

const DB_NAME = 'mas-bosques-db';
const DB_VERSION = 1;
const OUTBOX_STORE = 'incident-outbox';

async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
      }
    },
  });
}

export async function addIncidentToOutbox(incident: any) {
  const db = await getDB();
  const tx = db.transaction(OUTBOX_STORE, 'readwrite');
  tx.store.add(incident);
  return tx.done;
}
