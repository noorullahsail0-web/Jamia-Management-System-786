import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDocFromServer, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

console.log("Firebase Project ID:", firebaseConfig.projectId);
console.log("Firestore Database ID:", firebaseConfig.firestoreDatabaseId || '(default)');

// Clean up DB ID so we don't pass "(default)" literally as customized ID
const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? firebaseConfig.firestoreDatabaseId
  : undefined;

// Initialize Firestore with settings for better reliability in restricted environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: memoryLocalCache(),
}, dbId);

export const auth = getAuth(app);
export const storage = getStorage(app);

// Simple connection check without blocking with longer timeout
export async function testFirebaseConnection() {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return false;
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    // Check general connectivity
    await fetch('https://www.google.com', { 
      method: 'HEAD', 
      mode: 'no-cors',
      signal: controller.signal 
    });
    clearTimeout(timeoutId);
    return true;
  } catch (e) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      // Fallback: Check connection to the Firebase domain
      await fetch(`https://${firebaseConfig.projectId}.firebaseapp.com`, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return true;
    } catch (err) {
      console.warn("Firestore connection check failed: network is offline or blocked.");
      return false;
    }
  }
}


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
