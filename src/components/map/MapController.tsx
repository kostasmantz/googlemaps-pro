import { useEffect } from 'react';
import { useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { Place } from '../../types';

export function MapController({ places }: { places: Place[] }) {
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
