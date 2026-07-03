// Habit- and schedule-aware SURV drafts: the routine decisions (meals, plans,
// wind-down) pre-drafted for the current moment, ranked by the user's own
// posting habits. Pure functions — fully unit-testable.

import { currentActivity, upcomingEvents, whenLabel, type Activity, type CalEvent } from './schedule';
import { detectCategory } from './suggest';
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

/** What the general-public routine says you're doing → the decision category it feeds. */
const ACTIVITY_CATEGORY: Record<Activity, Category | null> = {
  eat: 'Food',
  exercise: 'Sports',
  play: 'Entertainment',
  work: 'Work',
  sleep: null,
};

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
  events: CalEvent[] = [],
): SurvDraft[] {
  const { slot, weekend, day } = timeContext(now);
  const nowMs = now.getTime();

  const catCount = new Map<Category, number>();
  for (const s of mySurvs) catCount.set(s.category, (catCount.get(s.category) ?? 0) + 1);

  const recentNorm = new Set(
    mySurvs.filter((s) => nowMs - s.createdAt < 20 * HOUR).map((s) => norm(s.question)),
  );

  const drafts: SurvDraft[] = [];

  // The routine layer: what the general-public schedule says you're doing right now.
  const activityCategory = (() => {
    const activity = currentActivity(now);
    return activity ? ACTIVITY_CATEGORY[activity] : null;
  })();

  for (const t of TEMPLATES) {
    if (!t.slots.includes(slot)) continue;
    if (t.weekend !== undefined && t.weekend !== weekend) continue;
    if (t.days && !t.days.includes(day)) continue;
    if (recentNorm.has(norm(t.question))) continue;
    const habitBoost = Math.min(catCount.get(t.category) ?? 0, 5) * 5;
    const routineBoost = t.category === activityCategory ? 12 : 0;
    drafts.push({
      id: `d_${norm(t.question).replace(/ /g, '_').slice(0, 48)}`,
      question: t.question,
      category: t.category,
      reason: t.reason,
      durationMs: t.durationMs,
      score: t.base + habitBoost + routineBoost,
    });
  }

  // The calendar layer: real upcoming events become decision drafts.
  for (const event of upcomingEvents(events, nowMs)) {
    const question = `${event.title} ${whenLabel(event.start, nowMs)} — what’s the plan?`;
    if (recentNorm.has(norm(question))) continue;
    drafts.push({
      id: `d_cal_${event.id.replace(/[^a-z0-9]/gi, '_').slice(0, 40)}`,
      question,
      category: detectCategory(event.title),
      reason: `📅 On your calendar ${whenLabel(event.start, nowMs)}`,
      durationMs: Math.min(Math.max(event.start - nowMs - HOUR, HOUR), DAY),
      score: 95,
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

// ---- category-tap question generation ----
// Tap a category in +SURV → a ready-made SMART question for right now,
// learned from the user's own recurring SURVs first, schedule second.

type SlotBank = Partial<Record<TimeSlot, string>> & { default: string };

const CATEGORY_QUESTIONS: Record<Category, SlotBank> = {
  Food: {
    morning: 'Breakfast this morning — what’s the move?',
    midday: 'Lunch today — where should I eat?',
    afternoon: 'Early dinner or late lunch today — what sounds right?',
    evening: 'Dinner tonight — where should I go?',
    night: 'Late-night bite tonight — worth it or sleep?',
    default: 'Next meal — what should it be?',
  },
  Shopping: { default: 'Should I buy it today or wait for a better price this week?' },
  Living: { default: 'What’s the one errand I should knock out today?' },
  Entertainment: {
    evening: 'What should we watch tonight?',
    night: 'One more episode tonight or save it?',
    default: 'What’s the entertainment pick for this week?',
  },
  Sports: { default: 'Workout today — gym, run, or rest day?' },
  Tech: { default: 'Upgrade this month or hold for the next release?' },
  Travel: { default: 'Next weekend trip — where should it be? Deciding by Friday.' },
  Style: { default: 'New look this week — go for it or keep it classic?' },
  Work: { default: 'What’s my top priority to finish by end of day?' },
  Relationships: { default: 'Who should I catch up with this week?' },
};

/**
 * A ready-to-post question for a tapped category: the user's own recurring
 * question in that category wins (machine-learned habit); otherwise a
 * time-slot-appropriate SMART template, localized with their city when known.
 */
export function categoryQuestion(
  category: Category,
  mySurvs: Surv[],
  now: Date = new Date(),
  city?: string | null,
): string {
  // Habit first: a question they've asked 2+ times in this category.
  const freq = new Map<string, { count: number; question: string }>();
  for (const s of mySurvs) {
    if (s.category !== category) continue;
    const k = norm(s.question);
    const cur = freq.get(k);
    if (cur) cur.count += 1;
    else freq.set(k, { count: 1, question: s.question });
  }
  const habitual = [...freq.values()].filter((f) => f.count >= 2).sort((a, b) => b.count - a.count)[0];
  if (habitual) return habitual.question;

  const { slot } = timeContext(now);
  const bank = CATEGORY_QUESTIONS[category];
  let question = bank[slot] ?? bank.default;
  if (city && (category === 'Food' || category === 'Entertainment' || category === 'Travel')) {
    question = question.replace(' — ', ` near ${city} — `);
  }
  return question;
}
