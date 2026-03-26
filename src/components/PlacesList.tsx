import { motion } from 'motion/react';
import { MapPin, ChevronRight, ExternalLink, Trash2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { Place } from '../types';
import { CATEGORIES } from '../utils/constants';

interface PlacesListProps {
  places: Place[];
  onEditPlace: (place: Place) => void;
  onDeletePlace: (id: string) => void;
  onAddPlaces: () => void;
}

export function PlacesList({ places, onEditPlace, onDeletePlace, onAddPlaces }: PlacesListProps) {
  if (places.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <MapPin className="w-10 h-10 text-slate-300" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">No places found</h3>
        <p className="text-slate-500 text-sm max-w-[240px] mt-1">
          Import your Google Maps list to get started.
        </p>
        <button
          onClick={onAddPlaces}
          className="mt-6 text-blue-600 font-semibold flex items-center gap-1"
        >
          Add Places <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {places.map((place) => (
        <motion.div
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          key={place.id}
          onClick={() => onEditPlace(place)}
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
                  onDeletePlace(place.id);
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
  );
}
