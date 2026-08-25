// The personal intelligence layer: SURV studies YOUR habits, trends, and
// graded outcomes — what you asked, what you picked, how it went — and turns
// that record into curated predictions. Curation strength grows with your
// SAGEmeter: the closer you are to Sage, the more your own proven judgment
// steers what SURV offers you. Pure functions — fully unit-testable.

import type { Category, Surv, User } from './types';

export interface CategoryRecord {
  asked: number;
  graded: number;
  good: number;
  /** 0–1; 0.5 when there's no evidence yet. */
  goodRate: number;
}

/** Per-category track record from the user's own graded history. */
export function outcomeStats(mySurvs: Surv[]): Partial<Record<Category, CategoryRecord>> {
  const out: Partial<Record<Category, CategoryRecord>> = {};
  for (const s of mySurvs) {
    const rec = (out[s.category] ??= { asked: 0, graded: 0, good: 0, goodRate: 0.5 });
    rec.asked += 1;
    if (s.status === 'graded') {
      rec.graded += 1;
      if (s.outcome === 'good') rec.good += 1;
    }
  }
  for (const rec of Object.values(out)) {
    if (rec && rec.graded > 0) rec.goodRate = rec.good / rec.graded;
  }
  return out;
}

/**
 * Options the user actually acted on and graded 👍, best-proven first.
 * These are the picks their own life has validated — the strongest possible
 * suggestion signal, above any chart or template.
 */
export function provenPicks(mySurvs: Surv[], category?: Category, limit = 4): string[] {
  const wins = new Map<string, number>();
  for (const s of mySurvs) {
    if (s.status !== 'graded' || s.outcome !== 'good' || !s.actedOptionId) continue;
    if (category && s.category !== category) continue;
    const acted = s.options.find((o) => o.id === s.actedOptionId);
    if (!acted) continue;
    wins.set(acted.label, (wins.get(acted.label) ?? 0) + 1);
  }
  return [...wins.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label]) => label);
}

/**
 * How strongly curation steers suggestions, gated by the SAGEmeter — the
 * road to Sage is also the road to a feed shaped by your own good calls.
 * Hatchling (<40): learning you. Owl (40+): light touch. Sage (60+): full.
 */
export function curationLevel(clout: number): 0 | 1 | 2 {
  if (clout >= 60) return 2;
  if (clout >= 40) return 1;
  return 0;
}

/**
 * Draft-score boost for a category, from the user's own outcome record.
 * A category where their decisions keep going well earns its way up; one
 * that keeps going badly quiets down. Scaled by curation level.
 */
export function outcomeBoost(
  stats: Partial<Record<Category, CategoryRecord>>,
  category: Category,
  me: User,
): number {
  const level = curationLevel(me.clout);
  if (level === 0) return 0;
  const rec = stats[category];
  if (!rec || rec.graded === 0) return 0;
  // Evidence-weighted: one lucky call moves little; a real streak moves a lot.
  const evidence = Math.min(rec.graded / 4, 1);
  const lean = (rec.goodRate - 0.5) * 2; // −1..1
  return Math.round(lean * evidence * (level === 2 ? 14 : 7));
}

/** A human line explaining WHY something is curated — trust through honesty. */
export function curationReason(
  stats: Partial<Record<Category, CategoryRecord>>,
  category: Category,
): string | null {
  const rec = stats[category];
  if (!rec || rec.graded < 2 || rec.goodRate < 0.6) return null;
  return `You’re ${rec.good}-for-${rec.graded} on ${category} calls`;
}
