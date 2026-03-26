import { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Place } from '../types';
import { handleFirestoreError, OperationType } from './errorHandling';

export async function savePlace(place: Place, user: FirebaseUser | null, setPlaces: (updater: (prev: Place[]) => Place[]) => void) {
  const path = `users/${user?.uid}/places`;
  try {
    if (user) {
      await setDoc(doc(db, path, place.id), place);
    } else {
      setPlaces(prev => [place, ...prev]);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${place.id}`);
  }
}

export async function deletePlace(id: string, user: FirebaseUser | null, setPlaces: (updater: (prev: Place[]) => Place[]) => void) {
  const path = `users/${user?.uid}/places`;
  try {
    if (user) {
      await deleteDoc(doc(db, path, id));
    } else {
      setPlaces(prev => prev.filter(p => p.id !== id));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
  }
}
