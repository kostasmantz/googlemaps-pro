import { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth } from '../services/firebase';

export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [firebaseRuntimeError, setFirebaseRuntimeError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
      });
      return () => unsubscribe();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setFirebaseRuntimeError(msg);
    }
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
      if (error instanceof Error) setFirebaseRuntimeError(error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
      if (error instanceof Error) setFirebaseRuntimeError(error.message);
    }
  };

  return {
    user,
    firebaseRuntimeError,
    handleLogin,
    handleLogout
  };
}
