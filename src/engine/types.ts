// Core domain types for the SURV decision engine.
// Mirrors the 2011 schema (survs, users.uweight, votes.weight, invite) and extends it
// with Nests, outcomes, and per-category SAGE.

export type Category =
  | 'Food'
  | 'Shopping'
  | 'Living'
  | 'Entertainment'
  | 'Sports'
  | 'Tech'
  | 'Travel'
  | 'Style'
  | 'Work'
  | 'Relationships';

export const CATEGORIES: Category[] = [
  'Food',
  'Shopping',
  'Living',
  'Entertainment',
  'Sports',
  'Tech',
  'Travel',
  'Style',
  'Work',
  'Relationships',
];

export type ClosenessTier = 'inner' | 'regular' | 'outer';

export interface NestMembership {
  userId: string;
  tier: ClosenessTier;
}

export interface Nest {
  id: string;
  name: string;
  emoji: string;
  ownerId: string;
  members: NestMembership[];
}

export type ConnectorId = 'facebook' | 'instagram' | 'discord' | 'yelp' | 'google_reviews';

export interface User {
  id: string;
  handle: string;
  name: string;
  avatar: string; // emoji avatar for v1
  bio: string;
  /** Global SAGEmeter, 0–100. Original beta started users at 30%. */
  clout: number;
  /** Observed expertise per category, 0–100, starts at 30. */
  categorySage: Partial<Record<Category, number>>;
  /** Asker→voter historical trust, 0–1, keyed by voter id. Starts 0.5. */
  pairTrust: Record<string, number>;
  connectors: ConnectorId[];
}

export type OptionSource = 'user' | 'ai' | 'yelp' | 'google_reviews' | 'history' | 'nest';

export interface SurvOption {
  id: string;
  label: string;
  source: OptionSource;
  /** One-line rationale shown under AI/connector suggestions. */
  why?: string;
}

export interface Vote {
  userId: string;
  optionId: string;
  /** Snapshot of the computed weight when the vote was cast (like votes.weight in 2011). */
  weight: number;
  votedAt: number;
}

/** Round Table — threaded talk on a SURV (original beta wishlist item). */
export interface SurvComment {
  id: string;
  userId: string;
  text: string;
  at: number;
}

export type SurvStatus = 'live' | 'deciding' | 'acted' | 'graded';
export type Outcome = 'good' | 'bad';

export type Audience = { kind: 'public' } | { kind: 'nests'; nestIds: string[] };

export interface Surv {
  id: string;
  askerId: string;
  question: string;
  category: Category;
  options: SurvOption[];
  audience: Audience;
  createdAt: number;
  expiresAt: number;
  status: SurvStatus;
  votes: Vote[];
  /** The option the asker actually acted on (the original "Check" step). */
  actedOptionId?: string;
  /** Swipe verdict: right = good, left = bad. */
  outcome?: Outcome;
  comments?: SurvComment[];
}

export interface OptionTally {
  optionId: string;
  label: string;
  rawCount: number;
  weightSum: number;
  /** Weighted share 0–100 — the option's SAGEmeter. */
  pct: number;
}
