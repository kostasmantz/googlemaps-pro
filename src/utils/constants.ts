import * as React from 'react';
import { Utensils, Camera, Coffee, MoreHorizontal, Tent, Beer } from 'lucide-react';
import { Category } from '../types';

export const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
export const hasValidKey = Boolean(GOOGLE_MAPS_API_KEY) && GOOGLE_MAPS_API_KEY !== 'YOUR_API_KEY';

export const CATEGORIES: { label: Category; icon: React.ReactNode; color: string; hex: string }[] = [
  { label: 'Restaurant', icon: React.createElement(Utensils, { className: 'w-4 h-4' }), color: 'bg-orange-100 text-orange-600', hex: '#ea580c' },
  { label: 'Cafe', icon: React.createElement(Coffee, { className: 'w-4 h-4' }), color: 'bg-amber-100 text-amber-600', hex: '#d97706' },
  { label: 'Pub', icon: React.createElement(Beer, { className: 'w-4 h-4' }), color: 'bg-red-100 text-red-600', hex: '#dc2626' },
  { label: 'Sightseeing', icon: React.createElement(Camera, { className: 'w-4 h-4' }), color: 'bg-indigo-100 text-indigo-600', hex: '#4f46e5' },
  { label: 'Campsite', icon: React.createElement(Tent, { className: 'w-4 h-4' }), color: 'bg-emerald-100 text-emerald-600', hex: '#059669' },
  { label: 'Other', icon: React.createElement(MoreHorizontal, { className: 'w-4 h-4' }), color: 'bg-slate-100 text-slate-600', hex: '#475569' },
];
