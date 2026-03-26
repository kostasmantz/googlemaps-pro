import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Plus } from 'lucide-react';
import { Collection } from '../../types';

interface NewCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateCollection: (name: string) => void;
}

export function NewCollectionModal({ isOpen, onClose, onCreateCollection }: NewCollectionModalProps) {
  const [name, setName] = React.useState('');

  const handleCreate = () => {
    if (name) {
      onCreateCollection(name);
      setName('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-slate-100 text-slate-900 font-bold rounded-xl active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!name}
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
  );
}

interface EditCollectionModalProps {
  collection: Collection | null;
  onClose: () => void;
  onUpdateCollection: (collection: Collection) => void;
  onDeleteCollection: (collection: Collection) => void;
}

export function EditCollectionModal({
  collection,
  onClose,
  onUpdateCollection,
  onDeleteCollection
}: EditCollectionModalProps) {
  const [name, setName] = React.useState(collection?.name || '');

  React.useEffect(() => {
    setName(collection?.name || '');
  }, [collection]);

  const handleSave = () => {
    if (collection && name) {
      onUpdateCollection({ ...collection, name });
    }
  };

  return (
    <AnimatePresence>
      {collection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 bg-slate-100 text-slate-900 font-bold rounded-xl active:scale-95 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!name}
                    className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl active:scale-95 transition-all disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>

                <button
                  onClick={() => {
                    if (collection) {
                      onDeleteCollection(collection);
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
  );
}

interface DeleteCollectionConfirmModalProps {
  collection: Collection | null;
  onClose: () => void;
  onConfirmDelete: (collection: Collection) => void;
}

export function DeleteCollectionConfirmModal({
  collection,
  onClose,
  onConfirmDelete
}: DeleteCollectionConfirmModalProps) {
  return (
    <AnimatePresence>
      {collection && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
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
              Are you sure you want to delete <span className="font-bold text-slate-900">"{collection.name}"</span>?
              All places in this list will be permanently removed.
            </p>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-slate-100 text-slate-900 font-bold rounded-xl active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => onConfirmDelete(collection)}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl active:scale-95 transition-all"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// Add React import
import * as React from 'react';
