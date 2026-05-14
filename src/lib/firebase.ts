import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

console.log("Firebase Project ID:", firebaseConfig.projectId);
console.log("Firestore Database ID:", firebaseConfig.firestoreDatabaseId || '(default)');

// Initialize Firestore with long polling to bypass potential proxy/socket issues
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');

export const auth = getAuth(app);
export const storage = getStorage(app);

// Simple connection check without blocking with longer timeout
export async function testFirebaseConnection(retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      console.log(`Checking Firestore connection (attempt ${i + 1})...`);
      // Use the path explicitly allowed for public read in firestore.rules
      const testDoc = doc(db, 'test', 'connection');
      await Promise.race([
        getDocFromServer(testDoc).catch(err => {
          // If it's "not-found" or "permission-denied", the server was reached!
          if (err.code === 'not-found' || err.code === 'permission-denied') return;
          throw err;
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 15000))
      ]);
      console.log("Firebase connection established successfully.");
      return true;
    } catch (error: any) {
      console.warn(`Firestore connection attempt ${i + 1} failed:`, error.message);
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait before retry
      }
    }
  }
  return false;
}

testFirebaseConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
