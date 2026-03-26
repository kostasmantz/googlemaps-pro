import { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Collection, Place } from '../types';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

export async function createCollection(
  name: string,
  user: FirebaseUser
): Promise<void> {
  if (!name) return;

  const id = Math.random().toString(36).substr(2, 9);
  try {
    await setDoc(doc(db, `users/${user.uid}/collections`, id), {
      id,
      name,
      createdAt: Date.now(),
      color: 'bg-blue-500'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/collections/${id}`);
  }
}

export async function updateCollection(
  collection: Collection,
  user: FirebaseUser
): Promise<void> {
  try {
    await updateDoc(doc(db, `users/${user.uid}/collections`, collection.id), {
      name: collection.name
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/collections/${collection.id}`);
  }
}

export async function deleteCollection(
  collection: Collection,
  user: FirebaseUser,
  places: Place[]
): Promise<void> {
  try {
    // Delete all places in this collection first
    const collectionPlaces = places.filter(p => p.collectionId === collection.id);
    for (const p of collectionPlaces) {
      await deleteDoc(doc(db, `users/${user.uid}/places`, p.id));
    }

    // Delete the collection itself
    await deleteDoc(doc(db, `users/${user.uid}/collections`, collection.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/collections/${collection.id}`);
  }
}
