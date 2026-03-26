import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, LinkIcon, Search, Edit3, Plus } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Category, Collection } from '../../types';
import { CATEGORIES } from '../../utils/constants';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  collections: Collection[];
  importTargetCollectionId: string;
  setImportTargetCollectionId: (id: string) => void;
  onLinkImport: (url: string) => Promise<void>;
  onSmartImport: (text: string) => Promise<void>;
  onManualAdd: (place: {
    name: string;
    address: string;
    categories: Category[];
    googleMapsUrl: string;
    note: string;
  }) => Promise<void>;
  isSyncing: boolean;
  importError: string | null;
}

export function ImportModal({
  isOpen,
  onClose,
  collections,
  importTargetCollectionId,
  setImportTargetCollectionId,
  onLinkImport,
  onSmartImport,
  onManualAdd,
  isSyncing,
  importError
}: ImportModalProps) {
  const [importMode, setImportMode] = useState<'link' | 'smart' | 'manual'>('link');
  const [importUrl, setImportUrl] = useState('');
  const [importText, setImportText] = useState('');
  const [manualPlace, setManualPlace] = useState({
    name: '',
    address: '',
    categories: ['Other'] as Category[],
    googleMapsUrl: '',
    note: ''
  });

  const handleLinkImportClick = async () => {
    await onLinkImport(importUrl);
    setImportUrl('');
  };

  const handleSmartImportClick = async () => {
    await onSmartImport(importText);
    setImportText('');
  };

  const handleManualAddClick = async () => {
    await onManualAdd(manualPlace);
    setManualPlace({ name: '', address: '', categories: ['Other'], googleMapsUrl: '', note: '' });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isSyncing && onClose()}
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
                onClick={onClose}
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
                      onClick={handleLinkImportClick}
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
                      onClick={handleSmartImportClick}
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
                      onChange={(e) => setManualPlace({ ...manualPlace, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Address</label>
                    <input
                      type="text"
                      placeholder="Full address"
                      value={manualPlace.address}
                      onChange={(e) => setManualPlace({ ...manualPlace, address: e.target.value })}
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
                      onChange={(e) => setManualPlace({ ...manualPlace, googleMapsUrl: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Note (Optional)</label>
                    <textarea
                      placeholder="Add a personal note..."
                      value={manualPlace.note}
                      onChange={(e) => setManualPlace({ ...manualPlace, note: e.target.value })}
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                    />
                  </div>

                  <button
                    onClick={handleManualAddClick}
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
                onClick={onClose}
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
  );
}
