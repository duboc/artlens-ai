import { Firestore, FieldValue } from '@google-cloud/firestore';
import { config } from '../config';

let db: Firestore | null = null;

export function getFirestore(): Firestore {
  if (!db) {
    db = new Firestore({
      projectId: config.projectId || undefined,
      databaseId: config.firestoreDb,
    });
  }
  return db;
}

export { FieldValue };
