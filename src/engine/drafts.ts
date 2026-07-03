// Habit- and schedule-aware SURV drafts: the routine decisions (meals, plans,
// wind-down) pre-drafted for the current moment, ranked by the user's own
// posting habits. Pure functions — fully unit-testable.

import type { Category, Surv, User } from './types';

export interface SurvDraft {
  id: string;
  question: string;
  category: Category;
  /** Why this draft is being offered right now. */
  reason: string;
  durationMs: number;
  score: number;
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export type TimeSlot = 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

export function timeContext(now: Date = new Date()) {
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday
  const weekend = day === 0 || day === 6;
  let slot: TimeSlot;
  if (hour >= 5 && hour < 11) slot = 'morning';
  else if (hour >= 11 && hour < 14) slot = 'midday';
  else if (hour >= 14 && hour < 17) slot = 'afternoon';
  else if (hour >= 17 && hour < 21) slot = 'evening';
  else slot = 'night';
  return { slot, weekend, day, hour };
}

interface DraftTemplate {
  slots: TimeSlot[];
  /** undefined = any; true = weekend only; false = weekdays only */
  weekend?: boolean;
  /** restrict to specific weekdays (0=Sun..6=Sat) */
  days?: number[];
  question: string;
  category: Category;
  reason: string;
  durationMs: number;
  base: number;
}

const TEMPLATES: DraftTemplate[] = [
  { slots: ['morning'], question: 'What’s for breakfast?', category: 'Food', reason: 'Breakfast time', durationMs: HOUR, base: 70 },
  { slots: ['morning'], weekend: false, question: 'Coffee run or brew at home?', category: 'Food', reason: 'Morning routine', durationMs: HOUR, base: 55 },
  { slots: ['midday'], question: 'What should I grab for lunch?', category: 'Food', reason: 'Lunch hour', durationMs: HOUR, base: 80 },
  { slots: ['afternoon'], question: 'Afternoon slump — coffee, walk, or push through?', category: 'Living', reason: 'Afternoon reset', durationMs: HOUR, base: 42 },
  { slots: ['afternoon'], weekend: false, question: 'Gym after work or straight home?', category: 'Sports', reason: 'End-of-day habit', durationMs: 2 * HOUR, base: 52 },
  { slots: ['evening'], question: 'What’s for dinner tonight?', category: 'Food', reason: 'Dinner time', durationMs: HOUR, base: 80 },
  { slots: ['evening'], question: 'Cook at home or order in?', category: 'Food', reason: 'Dinner time', durationMs: HOUR, base: 60 },
  { slots: ['evening', 'night'], days: [5], question: 'Friday night — what’s the move?', category: 'Entertainment', reason: 'It’s Friday', durationMs: 3 * HOUR, base: 78 },
  { slots: ['night'], question: 'One more episode or call it a night?', category: 'Entertainment', reason: 'Wind-down', durationMs: HOUR, base: 46 },
  { slots: ['morning', 'midday'], weekend: true, question: 'What’s the move today?', category: 'Living', reason: 'Weekend plans', durationMs: 3 * HOUR, base: 66 },
  { slots: ['evening'], days: [0], question: 'Meal prep — what’s the plan this week?', category: 'Food', reason: 'Sunday reset', durationMs: 12 * HOUR, base: 56 },
];

const norm = (q: string) => q.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();

/**
 * Ranked drafts for right now: schedule templates boosted by the user's own
 * category habits, plus their genuinely recurring SURVs resurfaced as
 * "your usual". Anything already asked in the last 20h is suppressed.
 */
export function buildDrafts(
  mySurvs: Surv[],
  _me: User,
  now: Date = new Date(),
  limit = 4,
): SurvDraft[] {
  const { slot, weekend, day } = timeContext(now);
  const nowMs = now.getTime();

  const catCount = new Map<Category, number>();
  for (const s of mySurvs) catCount.set(s.category, (catCount.get(s.category) ?? 0) + 1);

  const recentNorm = new Set(
    mySurvs.filter((s) => nowMs - s.createdAt < 20 * HOUR).map((s) => norm(s.question)),
  );

  const drafts: SurvDraft[] = [];

  for (const t of TEMPLATES) {
    if (!t.slots.includes(slot)) continue;
    if (t.weekend !== undefined && t.weekend !== weekend) continue;
    if (t.days && !t.days.includes(day)) continue;
    if (recentNorm.has(norm(t.question))) continue;
    const habitBoost = Math.min(catCount.get(t.category) ?? 0, 5) * 5;
    drafts.push({
      id: `d_${norm(t.question).replace(/ /g, '_').slice(0, 48)}`,
      question: t.question,
      category: t.category,
      reason: t.reason,
      durationMs: t.durationMs,
      score: t.base + habitBoost,
    });
  }

  // Genuinely recurring SURVs resurface as "your usual".
  const freq = new Map<string, { count: number; last: Surv }>();
  for (const s of mySurvs) {
    const k = norm(s.question);
    const cur = freq.get(k);
    if (cur) {
      cur.count += 1;
      if (s.createdAt > cur.last.createdAt) cur.last = s;
    } else {
      freq.set(k, { count: 1, last: s });
    }
  }
  for (const [k, { count, last }] of freq) {
    if (count < 2 || recentNorm.has(k)) continue;
    drafts.push({
      id: `d_usual_${k.replace(/ /g, '_').slice(0, 40)}`,
      question: last.question,
      category: last.category,
      reason: `Your usual — you’ve SURV’d this ${count}×`,
      durationMs: Math.min(Math.max(last.expiresAt - last.createdAt, HOUR), DAY),
      score: 85 + count * 3,
    });
  }

  return drafts.sort((a, b) => b.score - a.score).slice(0, limit);
}
