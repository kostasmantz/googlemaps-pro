export interface Place {
  id: string;
  name: string;
  address: string;
  categories: Category[];
  latitude: number;
  longitude: number;
  googleMapsUrl?: string;
  note?: string;
  importedAt: number;
  collectionId: string;
}

export type Category = 'Restaurant' | 'Cafe' | 'Campsite' | 'Other';

export interface Collection {
  id: string;
  name: string;
  createdAt: number;
  color?: string;
}
