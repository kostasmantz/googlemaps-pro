import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Place, Category, Collection } from '../../types';
import { CATEGORIES } from '../../utils/constants';

interface EditPlaceModalProps {
  place: Place | null;
  onClose: () => void;
  onUpdatePlace: (place: Place) => void;
  collections: Collection[];
}

export function EditPlaceModal({ place, onClose, onUpdatePlace, collections }: EditPlaceModalProps) {
  if (!place) return null;

  const handleUpdate = (updates: Partial<Place>) => {
    onUpdatePlace({ ...place, ...updates });
  };

  return (
    <AnimatePresence>
      {place && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
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
                onClick={onClose}
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
                  value={place.name}
                  onChange={(e) => handleUpdate({ name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Note</label>
                <textarea
                  placeholder="Add a personal note..."
                  value={place.note || ''}
                  onChange={(e) => handleUpdate({ note: e.target.value })}
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
                      onClick={() => handleUpdate({ collectionId: coll.id })}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-all border-2",
                        place.collectionId === coll.id
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
                  {CATEGORIES.map(c => {
                    const isSelected = place.categories?.includes(c.label);
                    return (
                      <button
                        key={c.label}
                        onClick={() => {
                          const current = place.categories || [];
                          const next = isSelected
                            ? current.filter(cat => cat !== c.label)
                            : [...current, c.label];
                          handleUpdate({ categories: next });
                        }}
                        className={cn(
                          "flex items-center gap-3 p-4 rounded-2xl text-sm font-bold transition-all border-2",
                          isSelected
                            ? "bg-blue-50 border-blue-600 text-blue-600 shadow-sm"
                            : "bg-white border-slate-100 text-slate-600 hover:border-slate-200"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                        )}>
                          {c.icon}
                        </div>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={onClose}
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
  );
}
