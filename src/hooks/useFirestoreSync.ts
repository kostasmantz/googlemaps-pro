import { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Place, Collection } from '../types';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

export function useFirestoreSync(user: FirebaseUser | null) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  useEffect(() => {
    if (!user) {
      // Load from local storage if not logged in
      const saved = localStorage.getItem('maplist_places');
      if (saved) setPlaces(JSON.parse(saved));
      return;
    }

    // Sync Collections
    const collectionsQ = query(collection(db, `users/${user.uid}/collections`), orderBy('createdAt', 'asc'));
    const unsubscribeCollections = onSnapshot(collectionsQ, (snapshot) => {
      const firestoreCollections = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Collection));
      setCollections(firestoreCollections);

      // If no collections exist, create a default one
      if (firestoreCollections.length === 0) {
        const defaultColl: Collection = {
          id: 'default',
          name: 'My Places',
          createdAt: Date.now(),
          color: 'bg-blue-500'
        };
        setDoc(doc(db, `users/${user.uid}/collections`, defaultColl.id), defaultColl).catch(error => {
          handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/collections/${defaultColl.id}`);
        });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/collections`);
    });

    // Sync Places
    const q = query(collection(db, `users/${user.uid}/places`), orderBy('importedAt', 'desc'));
    const unsubscribePlaces = onSnapshot(q, (snapshot) => {
      const firestorePlaces = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Place));
      setPlaces(firestorePlaces);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/places`);
    });

    return () => {
      unsubscribeCollections();
      unsubscribePlaces();
    };
  }, [user]);

  // Persist to Local Storage (only if not logged in)
  useEffect(() => {
    if (!user) {
      localStorage.setItem('maplist_places', JSON.stringify(places));
    }
  }, [places, user]);

  return {
    places,
    setPlaces,
    collections,
    setCollections
  };
}
