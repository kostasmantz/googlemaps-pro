import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

// `tsconfig.json` in this project does not include Node types.
// We only need `process.env` for Vite-injected build-time variables.
declare const process: { env: Record<string, string | undefined> };

export let firebaseInitError: Error | null = null;

let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

try {

  const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY as string,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN as string,
    projectId: process.env.FIREBASE_PROJECT_ID as string,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET as string,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID as string,
    appId: process.env.FIREBASE_APP_ID as string,
  };

  const app = initializeApp(firebaseConfig);
  authInstance = getAuth(app);
  dbInstance = getFirestore(app, process.env.FIREBASE_FIRESTORE_DATABASE_ID as string);
} catch (err: unknown) {
  firebaseInitError = err instanceof Error ? err : new Error(String(err));
}

// Kept non-null for existing imports; the UI will guard on `firebaseInitError`.
export const auth = authInstance as unknown as Auth;
export const db = dbInstance as unknown as Firestore;
