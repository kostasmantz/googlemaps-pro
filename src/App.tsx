/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { Component, useState, useMemo, useEffect, useCallback } from 'react';
import { MapPin, Filter, Plus, Search, ChevronRight, Utensils, Camera, Trees, ShoppingBag, Coffee, MoreHorizontal, X, Map as MapIcon, Trash2, ExternalLink, Link as LinkIcon, Edit3, LogIn, LogOut, User, Tent } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, query, orderBy, deleteDoc, getDocFromCache, getDocFromServer, updateDoc } from 'firebase/firestore';
import { auth, db, firebaseInitError } from './services/firebase';
import { cn } from './utils/cn';
import { Place, Category, Collection } from './types';
import { extractPlacesFromText } from './services/geminiService';

// Error handling types
enum OperationType {
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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Error Boundary Component
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, errorInfo: string | null }> {
  public state = { hasError: false, errorInfo: null };

  constructor(props: { children: React.ReactNode }) {
    super(props);
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.errorInfo || '');
        if (parsed.error) displayMessage = `Firestore Error: ${parsed.error}`;
      } catch (e) {
        displayMessage = this.state.errorInfo || displayMessage;
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-slate-50">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <X className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Application Error</h2>
          <p className="text-slate-500 text-sm mb-6 max-w-xs">{displayMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-transform"
          >
            Reload App
          </button>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(GOOGLE_MAPS_API_KEY) && GOOGLE_MAPS_API_KEY !== 'YOUR_API_KEY';

const CATEGORIES: { label: Category; icon: React.ReactNode; color: string; hex: string }[] = [
  { label: 'Restaurant', icon: <Utensils className="w-4 h-4" />, color: 'bg-orange-100 text-orange-600', hex: '#ea580c' },
  { label: 'Cafe', icon: <Coffee className="w-4 h-4" />, color: 'bg-amber-100 text-amber-600', hex: '#d97706' },
  { label: 'Campsite', icon: <Tent className="w-4 h-4" />, color: 'bg-emerald-100 text-emerald-600', hex: '#059669' },
  { label: 'Other', icon: <MoreHorizontal className="w-4 h-4" />, color: 'bg-slate-100 text-slate-600', hex: '#475569' },
];

function MapController({ places }: { places: Place[] }) {
  const map = useMap();
  const coreLib = useMapsLibrary('core');
  
  useEffect(() => {
    if (!map || !coreLib || places.length === 0) return;
    const bounds = new coreLib.LatLngBounds();
    let hasValidCoords = false;
    places.forEach(p => {
      if (p.latitude && p.longitude) {
        bounds.extend({ lat: p.latitude, lng: p.longitude });
        hasValidCoords = true;
      }
    });
    if (hasValidCoords) {
      map.fitBounds(bounds);
      // Don't zoom in too far if there's only one point
      if (places.length === 1) {
        const listener = google.maps.event.addListener(map, 'idle', () => {
          if (map.getZoom()! > 15) map.setZoom(15);
          google.maps.event.removeListener(listener);
        });
      }
    }
  }, [map, coreLib, places]);
  return null;
}

function GeocodingSync({ places, user }: { places: Place[], user: FirebaseUser | null }) {
  const geocodingLib = useMapsLibrary('geocoding');
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    if (!geocodingLib || !user || isGeocoding) return;

    const placesToGeocode = places.filter(p => !p.latitude || !p.longitude);
    if (placesToGeocode.length === 0) return;

    const geocodeNext = async () => {
      setIsGeocoding(true);
      const p = placesToGeocode[0];
      
      if (!p.address || p.address.trim() === '') {
        console.warn("Skipping geocoding for place with empty address:", p.name);
        setIsGeocoding(false);
        return;
      }

      // Helper to parse DMS to Decimal Degrees
      const parseDMS = (dms: string) => {
        const parts = dms.match(/(\d+)°\s*(\d+)'\s*(\d+\.?\d*)"?\s*([NSEW])/i);
        if (!parts) return null;
        const degrees = parseFloat(parts[1]);
        const minutes = parseFloat(parts[2]);
        const seconds = parseFloat(parts[3]);
        const direction = parts[4].toUpperCase();
        let dd = degrees + minutes / 60 + seconds / 3600;
        if (direction === 'S' || direction === 'W') dd = dd * -1;
        return dd;
      };

      // Check for coordinate strings (e.g. "51.4038, -3.5591" or "51°24'14.0\"N 3°33'32.9\"W")
      const dmsMatches = p.address.match(/(\d+°\s*\d+'\s*\d+\.?\d*"?\s*[NS])\s*(\d+°\s*\d+'\s*\d+\.?\d*"?\s*[EW])/i);
      if (dmsMatches) {
        const lat = parseDMS(dmsMatches[1]);
        const lng = parseDMS(dmsMatches[2]);
        if (lat !== null && lng !== null) {
          const path = `users/${user.uid}/places`;
          await updateDoc(doc(db, path, p.id), { latitude: lat, longitude: lng });
          setIsGeocoding(false);
          return;
        }
      }

      const coordRegex = /([-+]?\d+\.?\d*)\s*,\s*([-+]?\d+\.?\d*)/;
      const match = p.address.match(coordRegex);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          const path = `users/${user.uid}/places`;
          await updateDoc(doc(db, path, p.id), { latitude: lat, longitude: lng });
          setIsGeocoding(false);
          return;
        }
      }

      const geocoder = new geocodingLib.Geocoder();
      
      try {
        const result = await geocoder.geocode({ address: p.address });
        if (result.results[0]) {
          const { lat, lng } = result.results[0].geometry.location;
          const path = `users/${user.uid}/places`;
          await updateDoc(doc(db, path, p.id), {
            latitude: lat(),
            longitude: lng()
          });
        }
      } catch (error: any) {
        console.error("Geocoding error for", p.name, error);
        // If it's an invalid request, we might want to mark it as "failed" so we don't keep retrying
        if (error.code === 'INVALID_REQUEST' || (error.message && error.message.includes('INVALID_REQUEST'))) {
          const path = `users/${user.uid}/places`;
          await updateDoc(doc(db, path, p.id), {
            latitude: -1, // Mark as failed/unmappable
            longitude: -1
          });
        }
      } finally {
        setIsGeocoding(false);
      }
    };

    geocodeNext();
  }, [geocodingLib, places, user, isGeocoding]);

  return null;
}

function MapMarker({ place }: { place: Place, key?: string }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: place.latitude || 0, lng: place.longitude || 0 }}
        onClick={() => setOpen(true)}
      >
        <Pin background={CATEGORIES.find(c => place.categories?.includes(c.label))?.hex || '#4285F4'} glyphColor="#fff" />
      </AdvancedMarker>
      {open && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="p-2 max-w-[200px]">
            <h3 className="font-bold text-sm mb-1">{place.name}</h3>
            <p className="text-xs text-slate-500 mb-2">{place.address}</p>
            {place.note && <p className="text-[10px] italic text-slate-400 mb-2">"{place.note}"</p>}
            <a 
              href={place.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + place.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-600 font-bold flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              View on Maps
            </a>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function App() {
  if (firebaseInitError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-center">
        <div className="max-w-md">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Firebase connection failed</h2>
          <p className="text-slate-600 mb-4 text-sm">
            {firebaseInitError.message || 'Please check your Firebase configuration.'}
          </p>
          <p className="text-slate-500 text-xs mb-6">
            Ensure your GitHub Pages build has the required `FIREBASE_*` environment variables.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-transform"
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTargetCollectionId, setImportTargetCollectionId] = useState<string>('');
  const [isNewCollectionModalOpen, setIsNewCollectionModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [firebaseRuntimeError, setFirebaseRuntimeError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'link' | 'smart' | 'manual'>('link');
  const [importText, setImportText] = useState('');
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);

  // Manual Form State
  const [manualPlace, setManualPlace] = useState({
    name: '',
    address: '',
    categories: ['Other'] as Category[],
    googleMapsUrl: '',
    note: ''
  });

  // Test Connection
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

  // Auth Listener
  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        if (!user) {
          // Load from local storage if not logged in
          const saved = localStorage.getItem('maplist_places');
          if (saved) setPlaces(JSON.parse(saved));
        }
      });
      return () => unsubscribe();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setFirebaseRuntimeError(msg);
      return;
    }
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!user) return;

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
      setPlaces([]);
    } catch (error) {
      console.error("Logout error:", error);
      if (error instanceof Error) setFirebaseRuntimeError(error.message);
    }
  };

  const savePlace = async (place: Place) => {
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
  };

  const deletePlace = async (id: string) => {
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
  };

  const filteredPlaces = useMemo(() => {
    return places.filter(place => {
      const matchesSearch = place.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           place.address.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || (place.categories && place.categories.includes(selectedCategory as Category));
      const matchesCollection = selectedCollectionId === 'all' || place.collectionId === selectedCollectionId;
      return matchesSearch && matchesCategory && matchesCollection;
    });
  }, [places, searchQuery, selectedCategory, selectedCollectionId]);

  const handleSmartImport = async () => {
    if (!importText) return;
    
    setIsSyncing(true);
    setImportError(null);
    
    try {
      const extractedPlaces = await extractPlacesFromText(importText);
      
      if (extractedPlaces.length === 0) {
        setImportError("No places could be identified in the text. Try copying the list content again.");
        return;
      }

      const targetCollectionId = importTargetCollectionId || (selectedCollectionId === 'all' ? (collections[0]?.id || 'default') : selectedCollectionId);

      const newPlaces: Place[] = extractedPlaces.map((p: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: p.name || 'Unknown Place',
        address: p.address || 'No address',
        categories: p.categories || (p.category ? [p.category] : ['Other']),
        latitude: p.latitude || 0,
        longitude: p.longitude || 0,
        googleMapsUrl: p.googleMapsUrl || '',
        note: p.note || '',
        collectionId: targetCollectionId,
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
      setIsImportModalOpen(false);
      setImportText('');
    } catch (error) {
      console.error("Smart Import error:", error);
      setImportError("Failed to extract places. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  };
  const handleLinkImport = async () => {
    if (!importUrl) return;
    
    setIsSyncing(true);
    setImportError(null);
    
    try {
      const response = await fetch('/api/parse-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl })
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

      const targetCollectionId = importTargetCollectionId || (selectedCollectionId === 'all' ? (collections[0]?.id || 'default') : selectedCollectionId);

      const newPlaces: Place[] = extractedPlaces.map((p: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: p.name || 'Unknown Place',
        address: p.address || 'No address',
        categories: p.categories || (p.category ? [p.category] : ['Other']),
        latitude: p.latitude || 0,
        longitude: p.longitude || 0,
        googleMapsUrl: p.googleMapsUrl || '',
        note: p.note || '',
        collectionId: targetCollectionId,
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
      setIsImportModalOpen(false);
      setImportUrl('');
    } catch (error: any) {
      console.error("Import error:", error);
      setImportError(error.message || "Failed to extract places. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualAdd = async () => {
    if (!manualPlace.name || !manualPlace.address) return;
    
    setIsSyncing(true);
    try {
      const targetCollectionId = importTargetCollectionId || (selectedCollectionId === 'all' ? (collections[0]?.id || 'default') : selectedCollectionId);

      const newPlace: Place = {
        ...manualPlace,
        id: Math.random().toString(36).substr(2, 9),
        importedAt: Date.now(),
        latitude: 0,
        longitude: 0,
        collectionId: targetCollectionId
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
    setIsImportModalOpen(false);
      setManualPlace({ name: '', address: '', categories: ['Other'], googleMapsUrl: '', note: '' });
    } catch (error) {
      console.error("Error adding place:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeletePlace = async (id: string) => {
    await deletePlace(id);
  };

  if (firebaseRuntimeError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 text-center">
        <div className="max-w-md">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Firebase connection failed</h2>
          <p className="text-slate-600 mb-4 text-sm">{firebaseRuntimeError}</p>
          <p className="text-slate-500 text-xs mb-6">
            If you recently changed secrets, wait for the next deployment to complete.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-transform"
          >
            Reload App
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto shadow-2xl relative overflow-hidden">
      {/* Header */}
      <header className="ios-blur sticky top-0 z-20 px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Places</h1>
            <div className="flex items-center gap-2">
              {user ? (
                <div className="flex items-center gap-1.5">
                  <img src={user.photoURL || ''} alt="" className="w-4 h-4 rounded-full" />
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{user.displayName?.split(' ')[0]}</span>
                  <button onClick={handleLogout} className="text-[10px] text-red-500 font-bold uppercase tracking-wider ml-1">Logout</button>
                </div>
              ) : (
                <button onClick={handleLogin} className="flex items-center gap-1 text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                  <LogIn className="w-3 h-3" />
                  Login to Sync
                </button>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                setImportTargetCollectionId(selectedCollectionId === 'all' ? (collections[0]?.id || 'default') : selectedCollectionId);
                setIsImportModalOpen(true);
              }}
              className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Collections Selector */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
          <button
            onClick={() => setSelectedCollectionId('all')}
            className={cn(
              "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border-2",
              selectedCollectionId === 'all'
                ? "bg-slate-900 border-slate-900 text-white shadow-md"
                : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
            )}
          >
            All
          </button>
          {collections.map(coll => (
            <div key={coll.id} className="relative group flex-shrink-0">
              <button
                onClick={() => setSelectedCollectionId(coll.id)}
                onDoubleClick={() => setEditingCollection(coll)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border-2 flex items-center gap-2",
                  selectedCollectionId === coll.id
                    ? "bg-blue-600 border-blue-600 text-white shadow-md"
                    : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                )}
              >
                {coll.name}
                {selectedCollectionId === coll.id && (
                  <Edit3 
                    className="w-3 h-3 opacity-60 hover:opacity-100 cursor-pointer" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCollection(coll);
                    }}
                  />
                )}
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              console.log("Add collection button clicked");
              setIsNewCollectionModalOpen(true);
            }}
            className="p-2 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search your places..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100 border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-slate-200/50 rounded-xl mb-4">
          <button 
            onClick={() => setActiveTab('list')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all",
              activeTab === 'list' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
            )}
          >
            <Filter className="w-4 h-4" />
            List
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all",
              activeTab === 'map' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
            )}
          >
            <MapIcon className="w-4 h-4" />
            Map
          </button>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('All')}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
              selectedCategory === 'All' 
                ? "bg-slate-900 text-white" 
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.label}
              onClick={() => setSelectedCategory(cat.label)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                selectedCategory === cat.label 
                  ? "bg-slate-900 text-white" 
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-6">
        {activeTab === 'list' ? (
          filteredPlaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <MapPin className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">No places found</h3>
              <p className="text-slate-500 text-sm max-w-[240px] mt-1">
                {places.length === 0 
                  ? "Import your Google Maps list to get started." 
                  : "Try adjusting your search or filters."}
              </p>
              {places.length === 0 && (
                <button 
                  onClick={() => setIsImportModalOpen(true)}
                  className="mt-6 text-blue-600 font-semibold flex items-center gap-1"
                >
                  Add Places <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPlaces.map((place) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={place.id}
                  onClick={() => setEditingPlace(place)}
                  className="group bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-start gap-4 active:bg-slate-50 transition-colors cursor-pointer relative"
                >
                  <div className="flex flex-col gap-1 shrink-0">
                    {place.categories && place.categories.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {place.categories.map(cat => (
                          <div 
                            key={cat}
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center",
                              CATEGORIES.find(c => c.label === cat)?.color || 'bg-slate-100 text-slate-600'
                            )}
                          >
                            {CATEGORIES.find(c => c.label === cat)?.icon || <MapPin className="w-5 h-5" />}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
                        <MapPin className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 truncate">{place.name}</h4>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{place.address}</p>
                    {place.note && (
                      <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 italic">
                        "{place.note}"
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {place.categories?.map(cat => {
                        const config = CATEGORIES.find(c => c.label === cat);
                        return (
                          <span 
                            key={cat} 
                            className={cn(
                              "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                              config?.color || "bg-slate-100 text-slate-500"
                            )}
                          >
                            {cat}
                          </span>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      {place.googleMapsUrl && (
                        <a 
                          href={place.googleMapsUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] font-bold text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md"
                        >
                          <ExternalLink className="w-3 h-3" /> MAPS
                        </a>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlace(place.id);
                        }}
                        className="text-[10px] font-bold text-red-500 flex items-center gap-1 bg-red-50 px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" /> DELETE
                      </button>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 self-center" />
                </motion.div>
              ))}
            </div>
          )
        ) : (
          <div className="h-[calc(100vh-320px)] rounded-3xl overflow-hidden shadow-xl border border-slate-100 relative">
            {!hasValidKey ? (
              <div className="absolute inset-0 bg-slate-50 flex items-center justify-center p-8 text-center">
                <div className="max-w-md">
                  <MapIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h2 className="text-xl font-bold text-slate-900 mb-2">Map View Locked</h2>
                  <p className="text-slate-500 text-sm mb-6">To view your pins on a map, please add your Google Maps API key in the settings.</p>
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 text-left">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wider">How to unlock:</p>
                    <ol className="text-[10px] text-slate-600 space-y-2 list-decimal ml-4 font-medium">
                      <li>Open <b>Settings</b> (gear icon, top-right)</li>
                      <li>Go to <b>Secrets</b></li>
                      <li>Add <code>GOOGLE_MAPS_PLATFORM_KEY</code></li>
                    </ol>
                  </div>
                </div>
              </div>
            ) : (
              <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
                <Map
                  defaultCenter={{ lat: 48.8566, lng: 2.3522 }}
                  defaultZoom={12}
                  mapId="DEMO_MAP_ID"
                  className="w-full h-full"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                >
                  <MapController places={filteredPlaces} />
                  <GeocodingSync places={places} user={user} />
                  {filteredPlaces.map(place => (
                    (place.latitude || place.longitude) ? (
                      <MapMarker key={place.id} place={place} />
                    ) : null
                  ))}
                </Map>
              </APIProvider>
            )}
          </div>
        )}
      </main>

      {/* Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSyncing && setIsImportModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Add Places</h2>
                <button 
                  onClick={() => setIsImportModalOpen(false)}
                  disabled={isSyncing}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
                <button
                  onClick={() => setImportMode('link')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all",
                    importMode === 'link' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                  )}
                >
                  <LinkIcon className="w-4 h-4" />
                  Link
                </button>
                <button
                  onClick={() => setImportMode('smart')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all",
                    importMode === 'smart' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                  )}
                >
                  <Search className="w-4 h-4" />
                  Smart
                </button>
                <button
                  onClick={() => setImportMode('manual')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all",
                    importMode === 'manual' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                  )}
                >
                  <Edit3 className="w-4 h-4" />
                  Manual
                </button>
              </div>

              {/* Collection Selector */}
              <div className="mb-6">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1.5 block">Add to List</label>
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {collections.map(coll => (
                    <button
                      key={coll.id}
                      onClick={() => setImportTargetCollectionId(coll.id)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border-2",
                        importTargetCollectionId === coll.id
                          ? "bg-blue-600 border-blue-600 text-white shadow-md"
                          : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                      )}
                    >
                      {coll.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                {importMode === 'link' && (
                  <>
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                      <h3 className="text-blue-800 font-semibold text-sm mb-1">Import from Link:</h3>
                      <p className="text-blue-700 text-xs">
                        Paste the link to your public Google Maps list. Note: Some lists may be blocked by Google's security.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div className="relative">
                        <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input 
                          type="url"
                          placeholder="https://www.google.com/maps/lists/..."
                          value={importUrl}
                          onChange={(e) => setImportUrl(e.target.value)}
                          disabled={isSyncing}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                        />
                      </div>
                      
                      {importError && (
                        <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                          <p className="text-xs text-red-600 font-medium">{importError}</p>
                          <button 
                            onClick={() => setImportMode('smart')}
                            className="text-xs text-blue-600 font-bold mt-2 underline"
                          >
                            Try Smart Paste instead (more reliable)
                          </button>
                        </div>
                      )}

                      <button
                        onClick={handleLinkImport}
                        disabled={isSyncing || !importUrl}
                        className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                      >
                        {isSyncing ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Parsing...
                          </>
                        ) : (
                          <>
                            <Plus className="w-5 h-5" />
                            Import Places
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}

                {importMode === 'smart' && (
                  <>
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                      <h3 className="text-emerald-800 font-semibold text-sm mb-1">Smart Paste (Recommended):</h3>
                      <p className="text-emerald-700 text-xs">
                        Copy the text from your Google Maps list (select all names/addresses) and paste it here. AI will extract everything.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <textarea 
                        placeholder="Paste list content here..."
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        disabled={isSyncing}
                        rows={6}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none resize-none"
                      />
                      
                      {importError && (
                        <p className="text-xs text-red-500 px-2 font-medium">{importError}</p>
                      )}

                      <button
                        onClick={handleSmartImport}
                        disabled={isSyncing || !importText}
                        className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                      >
                        {isSyncing ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            AI Extracting...
                          </>
                        ) : (
                          <>
                            <Search className="w-5 h-5" />
                            Extract & Add
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}

                {importMode === 'manual' && (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Place Name</label>
                      <input 
                        type="text"
                        placeholder="e.g. Central Park"
                        value={manualPlace.name}
                        onChange={(e) => setManualPlace({...manualPlace, name: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Address</label>
                      <input 
                        type="text"
                        placeholder="Full address"
                        value={manualPlace.address}
                        onChange={(e) => setManualPlace({...manualPlace, address: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Categories</label>
                      <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map(c => (
                          <button
                            key={c.label}
                            type="button"
                            onClick={() => {
                              const current = manualPlace.categories;
                              if (current.includes(c.label)) {
                                setManualPlace({ ...manualPlace, categories: current.filter(cat => cat !== c.label) });
                              } else {
                                setManualPlace({ ...manualPlace, categories: [...current, c.label] });
                              }
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                              manualPlace.categories.includes(c.label)
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            {c.icon}
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Maps URL (Optional)</label>
                      <input 
                        type="url"
                        placeholder="https://goo.gl/maps/..."
                        value={manualPlace.googleMapsUrl}
                        onChange={(e) => setManualPlace({...manualPlace, googleMapsUrl: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Note (Optional)</label>
                      <textarea 
                        placeholder="Add a personal note..."
                        value={manualPlace.note}
                        onChange={(e) => setManualPlace({...manualPlace, note: e.target.value})}
                        rows={2}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                      />
                    </div>
                    
                    <button
                      onClick={handleManualAdd}
                      disabled={isSyncing || !manualPlace.name || !manualPlace.address}
                      className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
                    >
                      {isSyncing ? "Adding..." : "Add Place"}
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-8 safe-area-bottom">
                <button 
                  onClick={() => setIsImportModalOpen(false)}
                  disabled={isSyncing}
                  className="w-full py-4 bg-slate-100 text-slate-900 font-bold rounded-2xl active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Collection Modal */}
      <AnimatePresence>
        {isNewCollectionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsNewCollectionModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
            >
              <h2 className="text-xl font-bold mb-4">New Collection</h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Name</label>
                  <input 
                    type="text"
                    placeholder="e.g., Wales Trip"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsNewCollectionModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-900 font-bold rounded-xl active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      console.log("Creating collection:", newCollectionName);
                      if (newCollectionName && user) {
                        const id = Math.random().toString(36).substr(2, 9);
                        try {
                          await setDoc(doc(db, `users/${user.uid}/collections`, id), {
                            id,
                            name: newCollectionName,
                            createdAt: Date.now(),
                            color: 'bg-blue-500'
                          });
                          console.log("Collection created successfully");
                          setIsNewCollectionModalOpen(false);
                          setNewCollectionName('');
                        } catch (error) {
                          console.error("Error creating collection:", error);
                          handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/collections/${id}`);
                        }
                      }
                    }}
                    disabled={!newCollectionName}
                    className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Collection Modal */}
      <AnimatePresence>
        {editingCollection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingCollection(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl"
            >
              <h2 className="text-xl font-bold mb-4">Edit List</h2>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Name</label>
                  <input 
                    type="text"
                    placeholder="List name"
                    value={editingCollection.name}
                    onChange={(e) => setEditingCollection({...editingCollection, name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>
                
                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setEditingCollection(null)}
                      className="flex-1 py-3 bg-slate-100 text-slate-900 font-bold rounded-xl active:scale-95 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={async () => {
                        if (editingCollection && user) {
                          try {
                            await updateDoc(doc(db, `users/${user.uid}/collections`, editingCollection.id), {
                              name: editingCollection.name
                            });
                            setEditingCollection(null);
                          } catch (error) {
                            handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/collections/${editingCollection.id}`);
                          }
                        }
                      }}
                      disabled={!editingCollection.name}
                      className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => {
                      if (editingCollection) {
                        setCollectionToDelete(editingCollection);
                        setEditingCollection(null);
                      }
                    }}
                    className="w-full py-3 bg-red-50 text-red-600 font-bold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete List
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {collectionToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCollectionToDelete(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">Delete List?</h2>
              <p className="text-slate-500 text-sm mb-6">
                Are you sure you want to delete <span className="font-bold text-slate-900">"{collectionToDelete.name}"</span>? 
                All places in this list will be permanently removed.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setCollectionToDelete(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-900 font-bold rounded-xl active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    if (collectionToDelete && user) {
                      try {
                        // Delete all places in this collection first
                        const collectionPlaces = places.filter(p => p.collectionId === collectionToDelete.id);
                        for (const p of collectionPlaces) {
                          await deleteDoc(doc(db, `users/${user.uid}/places`, p.id));
                        }
                        
                        // Delete the collection itself
                        await deleteDoc(doc(db, `users/${user.uid}/collections`, collectionToDelete.id));
                        
                        if (selectedCollectionId === collectionToDelete.id) {
                          setSelectedCollectionId('all');
                        }
                        setCollectionToDelete(null);
                      } catch (error) {
                        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/collections/${collectionToDelete.id}`);
                      }
                    }
                  }}
                  className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl active:scale-95 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Editing Modal */}
      <AnimatePresence>
        {editingPlace && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingPlace(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Edit Place</h2>
                <button 
                  onClick={() => setEditingPlace(null)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Place Name</label>
                  <input 
                    type="text"
                    value={editingPlace.name}
                    onChange={async (e) => {
                      const newName = e.target.value;
                      const updated = { ...editingPlace, name: newName };
                      setEditingPlace(updated);
                      if (user) {
                        const path = `users/${user.uid}/places`;
                        await updateDoc(doc(db, path, editingPlace.id), { name: newName });
                      } else {
                        setPlaces(prev => prev.map(p => p.id === editingPlace.id ? updated : p));
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Note</label>
                  <textarea 
                    placeholder="Add a personal note..."
                    value={editingPlace.note || ''}
                    onChange={async (e) => {
                      const newNote = e.target.value;
                      const updated = { ...editingPlace, note: newNote };
                      setEditingPlace(updated);
                      if (user) {
                        const path = `users/${user.uid}/places`;
                        await updateDoc(doc(db, path, editingPlace.id), { note: newNote });
                      } else {
                        setPlaces(prev => prev.map(p => p.id === editingPlace.id ? updated : p));
                      }
                    }}
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Move to Collection</label>
                  <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {collections.map(coll => (
                      <button
                        key={coll.id}
                        onClick={async () => {
                          if (!editingPlace) return;
                          const updated = { ...editingPlace, collectionId: coll.id };
                          setEditingPlace(updated);
                          if (user) {
                            const path = `users/${user.uid}/places`;
                            try {
                              await updateDoc(doc(db, path, editingPlace.id), { collectionId: coll.id });
                            } catch (error) {
                              handleFirestoreError(error, OperationType.UPDATE, `${path}/${editingPlace.id}`);
                            }
                          } else {
                            setPlaces(prev => prev.map(p => p.id === editingPlace.id ? updated : p));
                          }
                        }}
                        className={cn(
                          "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border-2",
                          editingPlace.collectionId === coll.id
                            ? "bg-blue-600 border-blue-600 text-white shadow-md"
                            : "bg-white border-slate-100 text-slate-500 hover:border-slate-200"
                        )}
                      >
                        {coll.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Assign Categories</label>
                  <div className="grid grid-cols-2 gap-3">
                    {CATEGORIES.map(c => (
                      <button
                        key={c.label}
                        onClick={async () => {
                          if (!editingPlace) return;
                          const current = editingPlace.categories || [];
                          let next: Category[];
                          if (current.includes(c.label)) {
                            next = current.filter(cat => cat !== c.label);
                          } else {
                            next = [...current, c.label];
                          }
                          
                          const updated = { ...editingPlace, categories: next };
                          setEditingPlace(updated);
                          
                          // Update in Firestore or Local Storage
                          if (user) {
                            const path = `users/${user.uid}/places`;
                            await updateDoc(doc(db, path, editingPlace.id), { categories: next });
                          } else {
                            setPlaces(prev => prev.map(p => p.id === editingPlace.id ? updated : p));
                          }
                        }}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-2xl text-sm font-bold transition-all border-2",
                          editingPlace.categories?.includes(c.label)
                            ? "bg-blue-50 border-blue-600 text-blue-600 shadow-sm"
                            : "bg-white border-slate-100 text-slate-600 hover:border-slate-200"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          editingPlace.categories?.includes(c.label) ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                        )}>
                          {c.icon}
                        </div>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <button 
                    onClick={() => setEditingPlace(null)}
                    className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl shadow-lg active:scale-[0.98] transition-all"
                  >
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Nav Simulation - Removed as requested */}
    </div>
  );
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
