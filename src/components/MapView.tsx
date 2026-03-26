import { User as FirebaseUser } from 'firebase/auth';
import { APIProvider, Map } from '@vis.gl/react-google-maps';
import { MapIcon } from 'lucide-react';
import { Place } from '../types';
import { GOOGLE_MAPS_API_KEY, hasValidKey } from '../utils/constants';
import { MapController } from './map/MapController';
import { GeocodingSync } from './map/GeocodingSync';
import { MapMarker } from './map/MapMarker';

interface MapViewProps {
  places: Place[];
  filteredPlaces: Place[];
  user: FirebaseUser | null;
}

export function MapView({ places, filteredPlaces, user }: MapViewProps) {
  if (!hasValidKey) {
    return (
      <div className="h-[calc(100vh-320px)] rounded-3xl overflow-hidden shadow-xl border border-slate-100 relative">
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
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-320px)] rounded-3xl overflow-hidden shadow-xl border border-slate-100 relative">
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
          {filteredPlaces.map(place =>
            (place.latitude || place.longitude) ? (
              <MapMarker key={place.id} place={place} />
            ) : null
          )}
        </Map>
      </APIProvider>
    </div>
  );
}
