// SURV visual language v2 — night-sky brand, matured: deeper navy, calmer
// contrast, hairline borders over heavy shadows, consistent radii, and a
// single accent. Category iconography via Ionicons.

import type { Category } from './engine/types';

export const colors = {
  nightTop: '#0a1826',
  night: '#0f2438',
  nightCard: '#1a3450',
  panel: '#f7f9fa',
  panelDeep: '#e8edef',
  ink: '#1f2d38',
  inkSoft: '#5b6b77',
  inkFaint: '#98a6b0',
  owl: '#3aa587',
  owlDeep: '#2b8a6e',
  sage: '#4ec9b4',
  sageBar: '#67d3bf',
  moon: '#f4eec4',
  star: '#b9cbdc',
  danger: '#d9634f',
  good: '#4caf6d',
  white: '#ffffff',
  navy: '#0e2136',
  chip: '#dde4e7',
  hairline: 'rgba(31,45,56,0.08)',
};

export const fonts = {
  logo: { fontWeight: '800' as const, letterSpacing: 3 },
  title: { fontWeight: '700' as const },
  body: { fontWeight: '500' as const },
};

export const radius = { card: 16, chip: 20, button: 12 };

/** Display names — punchy, social-app style. Engine keys stay stable. */
export const CATEGORY_LABELS: Record<Category, string> = {
  Food: 'Food',
  Shopping: 'Shopping',
  Living: 'Life',
  Entertainment: 'Fun',
  Sports: 'Fitness',
  Tech: 'Tech',
  Travel: 'Travel',
  Style: 'Style',
  Work: 'Career',
  Relationships: 'Love',
};

/** Ionicons name per decision category. */
export const CATEGORY_ICONS: Record<Category, string> = {
  Food: 'restaurant',
  Shopping: 'cart',
  Living: 'home',
  Entertainment: 'film',
  Sports: 'basketball',
  Tech: 'hardware-chip',
  Travel: 'airplane',
  Style: 'shirt',
  Work: 'briefcase',
  Relationships: 'heart',
};

/** Ionicons name per connected platform. */
export const PLATFORM_ICONS: Record<string, string> = {
  facebook: 'logo-facebook',
  instagram: 'logo-instagram',
  discord: 'logo-discord',
  yelp: 'restaurant-outline',
  google_reviews: 'logo-google',
};

export const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  discord: 'Discord',
  yelp: 'Yelp',
  google_reviews: 'Google',
};
