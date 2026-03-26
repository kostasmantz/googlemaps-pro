import { useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Place, Category, Collection } from '../types';
import { extractPlacesFromText } from '../services/geminiService';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

export function useImportOperations(
  user: FirebaseUser | null,
  setPlaces: (updater: (prev: Place[]) => Place[]) => void,
  selectedCollectionId: string | 'all',
  collections: Collection[]
) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const getTargetCollectionId = (targetId?: string) => {
    return targetId || (selectedCollectionId === 'all' ? (collections[0]?.id || 'default') : selectedCollectionId);
  };

  const handleSmartImport = async (text: string, targetCollectionId?: string) => {
    if (!text) return;

    setIsSyncing(true);
    setImportError(null);

    try {
      const extractedPlaces = await extractPlacesFromText(text);

      if (extractedPlaces.length === 0) {
        setImportError("No places could be identified in the text. Try copying the list content again.");
        return;
      }

      const targetId = getTargetCollectionId(targetCollectionId);

      const newPlaces: Place[] = extractedPlaces.map((p: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: p.name || 'Unknown Place',
        address: p.address || 'No address',
        categories: p.categories || (p.category ? [p.category] : ['Other']),
        latitude: p.latitude || 0,
        longitude: p.longitude || 0,
        googleMapsUrl: p.googleMapsUrl || '',
        note: p.note || '',
        collectionId: targetId,
        importedAt: Date.now(),
      }));

      if (user) {
        const path = `users/${user.uid}/places`;
        for (const p of newPlaces) {
          try {
            await setDoc(doc(db, path, p.id), p);
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `${path}/${p.id}`);
          }
        }
      } else {
        setPlaces(prev => [...newPlaces, ...prev].sort((a, b) => b.importedAt - a.importedAt));
      }
    } catch (error) {
      console.error("Smart Import error:", error);
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.toLowerCase().includes('gemini api key is not configured')) {
        setImportError("Gemini is not configured. Add `GEMINI_API_KEY` in GitHub Secrets and redeploy, then try again.");
      } else {
        setImportError("Failed to extract places. Please try again.");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLinkImport = async (url: string, targetCollectionId?: string) => {
    if (!url) return;

    setIsSyncing(true);
    setImportError(null);

    try {
      const response = await fetch('/api/parse-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to parse list');
      }

      const { places: extractedPlaces } = await response.json();

      if (!extractedPlaces || extractedPlaces.length === 0) {
        setImportError("No places could be identified in this list. Make sure it's a public Google Maps list.");
        return;
      }

      const targetId = getTargetCollectionId(targetCollectionId);

      const newPlaces: Place[] = extractedPlaces.map((p: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: p.name || 'Unknown Place',
        address: p.address || 'No address',
        categories: p.categories || (p.category ? [p.category] : ['Other']),
        latitude: p.latitude || 0,
        longitude: p.longitude || 0,
        googleMapsUrl: p.googleMapsUrl || '',
        note: p.note || '',
        collectionId: targetId,
        importedAt: Date.now(),
      }));

      if (user) {
        const path = `users/${user.uid}/places`;
        for (const p of newPlaces) {
          try {
            await setDoc(doc(db, path, p.id), p);
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `${path}/${p.id}`);
          }
        }
      } else {
        setPlaces(prev => [...newPlaces, ...prev].sort((a, b) => b.importedAt - a.importedAt));
      }
    } catch (error: any) {
      console.error("Import error:", error);
      setImportError(error.message || "Failed to extract places. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualAdd = async (
    place: { name: string; address: string; categories: Category[]; googleMapsUrl: string; note: string },
    targetCollectionId?: string
  ) => {
    if (!place.name || !place.address) return;

    setIsSyncing(true);
    try {
      const targetId = getTargetCollectionId(targetCollectionId);

      const newPlace: Place = {
        ...place,
        id: Math.random().toString(36).substr(2, 9),
        importedAt: Date.now(),
        latitude: 0,
        longitude: 0,
        collectionId: targetId
      };

      if (user) {
        const path = `users/${user.uid}/places`;
        try {
          await setDoc(doc(db, path, newPlace.id), newPlace);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `${path}/${newPlace.id}`);
        }
      } else {
        setPlaces(prev => [newPlace, ...prev].sort((a, b) => b.importedAt - a.importedAt));
      }
    } catch (error) {
      console.error("Error adding place:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    isSyncing,
    importError,
    handleSmartImport,
    handleLinkImport,
    handleManualAdd
  };
}
