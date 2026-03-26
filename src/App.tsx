import { useState, useMemo } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, firebaseInitError } from './services/firebase';
import { Category, Place, Collection } from './types';
import { useAuth } from './hooks/useAuth';
import { useFirestoreSync } from './hooks/useFirestoreSync';
import { useFirebaseConnection } from './hooks/useFirebaseConnection';
import { useImportOperations } from './hooks/useImportOperations';
import { deletePlace } from './utils/placeOperations';
import { createCollection, updateCollection, deleteCollection } from './hooks/useCollectionOperations';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { PlacesList } from './components/PlacesList';
import { MapView } from './components/MapView';
import { ImportModal } from './components/modals/ImportModal';
import { EditPlaceModal } from './components/modals/EditPlaceModal';
import {
  NewCollectionModal,
  EditCollectionModal,
  DeleteCollectionConfirmModal
} from './components/modals/CollectionModals';

function App() {
  // Firebase initialization error check
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

  // Hooks
  const { user, firebaseRuntimeError: authError, handleLogin, handleLogout } = useAuth();
  const { firebaseRuntimeError: connectionError } = useFirebaseConnection();
  const { places, setPlaces, collections } = useFirestoreSync(user);

  // State
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTargetCollectionId, setImportTargetCollectionId] = useState<string>('');
  const [isNewCollectionModalOpen, setIsNewCollectionModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [collectionToDelete, setCollectionToDelete] = useState<Collection | null>(null);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);

  // Import operations
  const { isSyncing, importError, handleSmartImport, handleLinkImport, handleManualAdd } = useImportOperations(
    user,
    setPlaces,
    selectedCollectionId,
    collections
  );

  // Filtered places
  const filteredPlaces = useMemo(() => {
    return places.filter(place => {
      const matchesSearch = place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        place.address.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || (place.categories && place.categories.includes(selectedCategory as Category));
      const matchesCollection = selectedCollectionId === 'all' || place.collectionId === selectedCollectionId;
      return matchesSearch && matchesCategory && matchesCollection;
    });
  }, [places, searchQuery, selectedCategory, selectedCollectionId]);

  // Handlers
  const handleDeletePlace = async (id: string) => {
    await deletePlace(id, user, setPlaces);
  };

  const handleUpdatePlace = async (updatedPlace: Place) => {
    setEditingPlace(updatedPlace);
    if (user) {
      const path = `users/${user.uid}/places`;
      const { id, ...updateData } = updatedPlace;
      await updateDoc(doc(db, path, id), updateData);
    } else {
      setPlaces(prev => prev.map(p => p.id === updatedPlace.id ? updatedPlace : p));
    }
  };

  const handleCreateCollection = async (name: string) => {
    if (user) {
      await createCollection(name, user);
      setIsNewCollectionModalOpen(false);
    }
  };

  const handleUpdateCollection = async (collection: Collection) => {
    if (user) {
      await updateCollection(collection, user);
      setEditingCollection(null);
    }
  };

  const handleDeleteCollectionRequest = (collection: Collection) => {
    setCollectionToDelete(collection);
    setEditingCollection(null);
  };

  const handleConfirmDeleteCollection = async (collection: Collection) => {
    if (user) {
      await deleteCollection(collection, user, places);
      if (selectedCollectionId === collection.id) {
        setSelectedCollectionId('all');
      }
      setCollectionToDelete(null);
    }
  };

  const handleAddPlaceClick = () => {
    setImportTargetCollectionId(selectedCollectionId === 'all' ? (collections[0]?.id || 'default') : selectedCollectionId);
    setIsImportModalOpen(true);
  };

  const handleLogoutWithCleanup = async () => {
    await handleLogout();
    setPlaces([]);
  };

  // Runtime error check
  const firebaseRuntimeError = authError || connectionError;
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
      <Header
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogoutWithCleanup}
        onAddPlace={handleAddPlaceClick}
        selectedCollectionId={selectedCollectionId}
        setSelectedCollectionId={setSelectedCollectionId}
        collections={collections}
        setEditingCollection={setEditingCollection}
        setIsNewCollectionModalOpen={setIsNewCollectionModalOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
      />

      <main className="flex-1 px-4 py-6">
        {activeTab === 'list' ? (
          <PlacesList
            places={filteredPlaces.length > 0 ? filteredPlaces : (searchQuery || selectedCategory !== 'All' || selectedCollectionId !== 'all' ? [] : places)}
            onEditPlace={setEditingPlace}
            onDeletePlace={handleDeletePlace}
            onAddPlaces={() => setIsImportModalOpen(true)}
          />
        ) : (
          <MapView
            places={places}
            filteredPlaces={filteredPlaces}
            user={user}
          />
        )}
      </main>

      {/* Modals */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        collections={collections}
        importTargetCollectionId={importTargetCollectionId}
        setImportTargetCollectionId={setImportTargetCollectionId}
        onLinkImport={async (url) => {
          await handleLinkImport(url, importTargetCollectionId);
          if (!importError) setIsImportModalOpen(false);
        }}
        onSmartImport={async (text) => {
          await handleSmartImport(text, importTargetCollectionId);
          if (!importError) setIsImportModalOpen(false);
        }}
        onManualAdd={async (place) => {
          await handleManualAdd(place, importTargetCollectionId);
          setIsImportModalOpen(false);
        }}
        isSyncing={isSyncing}
        importError={importError}
      />

      <EditPlaceModal
        place={editingPlace}
        onClose={() => setEditingPlace(null)}
        onUpdatePlace={handleUpdatePlace}
        collections={collections}
      />

      <NewCollectionModal
        isOpen={isNewCollectionModalOpen}
        onClose={() => setIsNewCollectionModalOpen(false)}
        onCreateCollection={handleCreateCollection}
      />

      <EditCollectionModal
        collection={editingCollection}
        onClose={() => setEditingCollection(null)}
        onUpdateCollection={handleUpdateCollection}
        onDeleteCollection={handleDeleteCollectionRequest}
      />

      <DeleteCollectionConfirmModal
        collection={collectionToDelete}
        onClose={() => setCollectionToDelete(null)}
        onConfirmDelete={handleConfirmDeleteCollection}
      />
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
