import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

console.log("Firebase Project ID:", firebaseConfig.projectId);
console.log("Firestore Database ID:", firebaseConfig.firestoreDatabaseId || '(default)');

// Initialize Firestore with settings for better reliability in restricted environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  // In some environments, disabling fetch streams helps with proxy stability
  // experimentalAutoDetectLongPolling: true, 
}, firebaseConfig.firestoreDatabaseId || '(default)');

export const auth = getAuth(app);
export const storage = getStorage(app);

// Simple connection check without blocking with longer timeout
export async function testFirebaseConnection(retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      console.log(`Checking Firestore connection to database: ${firebaseConfig.firestoreDatabaseId || '(default)'} (attempt ${i + 1})...`);
      
      // Use getDocFromServer to force a network request
      const testDoc = doc(db, 'test', 'connection');
      const connectionPromise = getDocFromServer(testDoc).catch(err => {
        // If it's "not-found" or "permission-denied", the server was reached!
        // These are valid responses indicating connectivity to the backend.
        if (err.code === 'not-found' || err.code === 'permission-denied') {
          return { exists: () => false };
        }
        throw err;
      });

      await Promise.race([
        connectionPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connectivity test timeout (15s)')), 15000))
      ]);
      
      console.log("Firebase connection established successfully.");
      return true;
    } catch (error: any) {
      console.warn(`Firestore connection attempt ${i + 1} failed:`, error.message);
      if (error.message.includes('offline')) {
        console.error("Firestore client is in offline mode. This often means the backend is unreachable or blocked.");
      }
      if (i < retries) {
        // Exponential backoff
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay)); 
      }
    }
  }
  return false;
}

testFirebaseConnection().then(connected => {
  if (!connected) {
    console.error("FAILED to establish Firestore connection after multiple attempts.");
  }
});

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
