import { useState, useEffect } from 'react';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '../services/firebase';

export function useFirebaseConnection() {
  const [firebaseRuntimeError, setFirebaseRuntimeError] = useState<string | null>(null);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('auth/') || msg.includes('invalid-api-key')) {
          setFirebaseRuntimeError(msg);
          return;
        }
        if (msg.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  return { firebaseRuntimeError };
}
