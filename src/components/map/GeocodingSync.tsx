import { useState, useEffect } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Place } from '../../types';

export function GeocodingSync({ places, user }: { places: Place[], user: FirebaseUser | null }) {
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
