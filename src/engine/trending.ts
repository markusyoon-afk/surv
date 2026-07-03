// The Top 5 SURVs out there — proven, reusable decisions anyone can adopt
// for their own Nest in one tap. Every entry is SMART-framed by construction
// (specific, measurable options, achievable actions, relevant, time-bound) —
// enforced by the engine tests, invisible in the UI.
// With the shared backend this becomes a live "most-reused this week" chart.

import type { Category } from './types';

export interface TrendingSurv {
  id: string;
  question: string;
  category: Category;
  options: string[];
  durationMs: number;
  /** How many times it's been reused — seeded now, live with the backend. */
  reuses: number;
}

const HOUR = 3600_000;

export const TRENDING_SURVS: TrendingSurv[] = [
  {
    id: 'tr_dinner',
    question: 'Pizza night or something healthier tonight?',
    category: 'Food',
    options: ['Pizza it is', 'Sushi', 'Big salad + grill something'],
    durationMs: 2 * HOUR,
    reuses: 412,
  },
  {
    id: 'tr_watch',
    question: 'What should we watch this weekend?',
    category: 'Entertainment',
    options: ['That new thriller series', 'Comedy rewatch', 'Movie marathon night'],
    durationMs: 8 * HOUR,
    reuses: 356,
  },
  {
    id: 'tr_buy',
    question: 'Should I buy it now or wait for a sale this week?',
    category: 'Shopping',
    options: ['Buy it now', 'Wait for the sale', 'Skip it entirely'],
    durationMs: 8 * HOUR,
    reuses: 298,
  },
  {
    id: 'tr_workout',
    question: 'Morning workout or evening session tomorrow?',
    category: 'Sports',
    options: ['6am club', 'After work', 'Active rest day'],
    durationMs: 6 * HOUR,
    reuses: 245,
  },
  {
    id: 'tr_friends',
    question: 'Catch up with friends this weekend — night in or night out?',
    category: 'Relationships',
    options: ['Night in — board games', 'Night out', 'In Friday, out Saturday'],
    durationMs: 8 * HOUR,
    reuses: 231,
  },
];
