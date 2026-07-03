// Geolocation layer: GPS position (web geolocation API), reverse geocoding
// (OSM Nominatim), and real nearby places (Overpass API) — zero API keys.
// Feeds geolocated, timely option suggestions into the decision engine.

import { Platform } from 'react-native';
import type { Category } from '../engine/types';

export interface GeoPosition {
  lat: number;
  lon: number;
}

export interface NearbyPlace {
  name: string;
  distanceKm: number;
  kind: string;
}

const onWeb = () => Platform.OS === 'web' && typeof window !== 'undefined';

export function getCurrentPosition(): Promise<GeoPosition | null> {
  if (!onWeb() || !('geolocation' in window.navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    window.navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  });
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 9000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** City/town name for a coordinate (OSM Nominatim). */
export async function reverseCity(pos: GeoPosition): Promise<string | null> {
  try {
    const data = await fetchJson(
      `https://nominatim.openstreetmap.org/reverse?lat=${pos.lat}&lon=${pos.lon}&format=json&zoom=13`,
    );
    const a = data.address ?? {};
    return a.city || a.town || a.village || a.suburb || a.county || null;
  } catch {
    return null;
  }
}

/** OSM tag selectors per decision category. */
const CATEGORY_OSM: Partial<Record<Category, string>> = {
  Food: '["amenity"~"restaurant|cafe|fast_food"]',
  Entertainment: '["amenity"~"cinema|theatre|bar|pub"]',
  Sports: '["leisure"~"fitness_centre|sports_centre|park"]',
  Shopping: '["shop"~"mall|supermarket|department_store|electronics"]',
  Travel: '["tourism"~"attraction|museum|viewpoint"]',
};

export const GEO_CATEGORIES = Object.keys(CATEGORY_OSM) as Category[];

function haversineKm(a: GeoPosition, b: GeoPosition): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Real named places near the user for a category (Overpass API, ~2.5 km radius). */
export async function fetchNearbyPlaces(
  pos: GeoPosition,
  category: Category,
): Promise<NearbyPlace[]> {
  const selector = CATEGORY_OSM[category];
  if (!selector) return [];
  const query = `[out:json][timeout:8];(node(around:2500,${pos.lat},${pos.lon})${selector}["name"];);out body 24;`;
  try {
    const data = await fetchJson('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
    });
    const seen = new Set<string>();
    const places: NearbyPlace[] = [];
    for (const el of data.elements ?? []) {
      const name = el.tags?.name;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      places.push({
        name,
        distanceKm: Math.round(haversineKm(pos, { lat: el.lat, lon: el.lon }) * 10) / 10,
        kind: el.tags?.amenity || el.tags?.leisure || el.tags?.shop || el.tags?.tourism || 'place',
      });
    }
    return places.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 8);
  } catch {
    return [];
  }
}
