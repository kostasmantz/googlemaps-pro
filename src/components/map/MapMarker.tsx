import { useState } from 'react';
import { AdvancedMarker, Pin, InfoWindow, useAdvancedMarkerRef } from '@vis.gl/react-google-maps';
import { ExternalLink } from 'lucide-react';
import { Place } from '../../types';
import { CATEGORIES } from '../../utils/constants';

export function MapMarker({ place }: { place: Place; key?: string }) {
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
