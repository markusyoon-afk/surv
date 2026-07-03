// The public arena: a living stream of SURVs from the avatar population,
// thousands live at any hour. Fully deterministic from the clock, so every
// device sees the same arena without a byte of storage — your votes overlay
// locally, and outcomes train YOUR sage when you helped decide well.

import { getPopulation } from './population';
import type { Category, Outcome } from './types';

export interface ArenaOption {
  id: string;
  label: string;
}

export interface ArenaSurv {
  id: string;
  askerId: string;
  askerName: string;
  askerAvatar: string;
  question: string;
  category: Category;
  options: ArenaOption[];
  createdAt: number;
  expiresAt: number;
  /** total simulated votes so far */
  votes: number;
  /** simulated share per option, sums to 1 */
  split: number[];
  /** votes per minute — the hotness signal */
  velocity: number;
  badges: string[];
}

const MIN = 60_000;
const HOUR = 3600_000;
const BUCKET = 10 * MIN; // a new wave of SURVs every 10 minutes
/** 167 per 10-minute wave ≈ 1,002 brand-new SURVs entering the Forest every hour. */
export const PER_BUCKET = 167;
export const NEW_PER_HOUR = PER_BUCKET * 6;
const LOOKBACK_BUCKETS = 36; // 6 hours of waves
/** Deterministic sample of each wave rendered in the feed (the rest live in the stats). */
const DISPLAY_SLOTS = [0, 41, 83, 125];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BANK: Array<{ q: string; category: Category; options: string[] }> = [
  { q: 'Quit caffeine for 30 days starting Monday?', category: 'Living', options: ['Cold turkey', 'Half-caf taper', 'Keep the coffee'] },
  { q: 'New album drop — listen now or save for the road trip?', category: 'Entertainment', options: ['Now, obviously', 'Save it for the drive'] },
  { q: 'Ask for the raise this week or wait for review season?', category: 'Work', options: ['Ask this week', 'Wait for review', 'Start interviewing instead'] },
  { q: 'First marathon: sign up for spring or build a year?', category: 'Sports', options: ['Sign up — spring', 'Build a year first', 'Half marathon compromise'] },
  { q: 'Street tacos or the fancy omakase for the birthday dinner?', category: 'Food', options: ['Street tacos', 'Omakase', 'Tacos now, omakase later'] },
  { q: 'Upgrade the phone now or squeeze one more year?', category: 'Tech', options: ['Upgrade now', 'One more year', 'Buy last year’s model'] },
  { q: 'Tokyo or Lisbon for the fall trip?', category: 'Travel', options: ['Tokyo', 'Lisbon', 'Flip a coin at the airport'] },
  { q: 'Buzz cut season — commit or keep it long?', category: 'Style', options: ['Buzz it', 'Keep it long', 'Trim and decide next month'] },
  { q: 'Text them first or let it breathe a few days?', category: 'Relationships', options: ['Text first', 'Let it breathe', 'Call instead'] },
  { q: 'Stand mixer on sale — buy it or keep hand-mixing?', category: 'Shopping', options: ['Buy the mixer', 'Keep hand-mixing', 'Wait for a deeper sale'] },
  { q: 'Move the workout to mornings for winter?', category: 'Sports', options: ['Mornings all winter', 'Stay evening', 'Lunchtime split'] },
  { q: 'Host Friendsgiving this year or rotate it out?', category: 'Relationships', options: ['Host it', 'Rotate it out', 'Co-host with neighbors'] },
];

function makeArenaSurv(bucket: number, slot: number): ArenaSurv | null {
  const seed = bucket * 97 + slot * 13;
  const rand = mulberry32(seed);
  const item = BANK[Math.floor(rand() * BANK.length)];
  const createdAt = bucket * BUCKET + Math.floor(rand() * BUCKET);
  const lifetime = (2 + rand() * 4) * HOUR;
  const pop = getPopulation();
  const asker = pop[Math.floor(rand() * pop.length)];
  const velocity = 1 + rand() * 7;
  const raw = item.options.map(() => 0.35 + rand());
  const total = raw.reduce((s, r) => s + r, 0);
  return {
    id: `ar_${bucket}_${slot}`,
    askerId: asker.id,
    askerName: asker.name,
    askerAvatar: asker.avatar,
    question: item.q,
    category: item.category,
    options: item.options.map((label, i) => ({ id: `ao_${seed}_${i}`, label })),
    createdAt,
    expiresAt: createdAt + lifetime,
    votes: 0, // filled by caller for "now"
    split: raw.map((r) => r / total),
    velocity,
    badges: [],
  };
}

/** The live arena right now: top public SURVs, votes growing in real time. */
export function activeArenaSurvs(now = Date.now(), limit = 20): ArenaSurv[] {
  const currentBucket = Math.floor(now / BUCKET);
  const live: ArenaSurv[] = [];
  for (let b = currentBucket - LOOKBACK_BUCKETS; b <= currentBucket; b++) {
    for (const s of DISPLAY_SLOTS) {
      const surv = makeArenaSurv(b, s);
      if (!surv || surv.createdAt > now || surv.expiresAt < now) continue;
      const elapsedMin = (now - surv.createdAt) / MIN;
      surv.votes = Math.floor(elapsedMin * surv.velocity);
      live.push(surv);
    }
  }
  live.sort((a, b) => b.votes - a.votes);
  // merit badges for the leaders
  if (live[0]) live[0].badges.push('🏆 Top SURV');
  const hottest = [...live].sort((a, b) => b.velocity - a.velocity)[0];
  if (hottest) hottest.badges.push('🔥 Hottest');
  for (const s of live) {
    if (s.votes > 800) s.badges.push('💯 800+ voices');
  }
  return live.slice(0, limit);
}

/** A recently-ended arena SURV (for outcome processing), or null if still live. */
export function arenaResult(
  survId: string,
  now = Date.now(),
): { actedIndex: number; outcome: Outcome; category: Category; question: string; options: ArenaOption[] } | null {
  const m = survId.match(/^ar_(\d+)_(\d+)$/);
  if (!m) return null;
  const surv = makeArenaSurv(Number(m[1]), Number(m[2]));
  if (!surv || surv.expiresAt > now) return null;
  const rand = mulberry32(Number(m[1]) * 7 + Number(m[2]) * 31 + 5);
  // The asker follows the crowd most of the time; outcomes skew good.
  const actedIndex =
    rand() < 0.8 ? surv.split.indexOf(Math.max(...surv.split)) : Math.floor(rand() * surv.options.length);
  const outcome: Outcome = rand() < 0.7 ? 'good' : 'bad';
  return { actedIndex, outcome, category: surv.category, question: surv.question, options: surv.options };
}

/** Headline stats for the ticker — the scale of decisions moving through the Forest. */
export function arenaStats(now = Date.now()): {
  newThisHour: number;
  liveNow: number;
  votesLastHour: number;
} {
  const bucket = Math.floor(now / BUCKET);
  const rand = mulberry32(bucket);
  // ~1,002/hr entering × ~4h average lifetime ≈ ~4,000 live at any moment.
  return {
    newThisHour: NEW_PER_HOUR,
    liveNow: 3800 + Math.floor(rand() * 500),
    votesLastHour: 21_000 + Math.floor(rand() * 6000),
  };
}
