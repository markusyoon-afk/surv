// The SAGE engine: voter weighting + outcome-trained learning.
// Pure functions over the domain types so the whole loop is unit-testable
// and portable to a backend later unchanged.

import type {
  Category,
  ClosenessTier,
  Nest,
  OptionTally,
  Outcome,
  Surv,
  User,
} from './types';

export const SAGE_DEFAULT = 30; // original beta started the meter at 30%
export const TRUST_DEFAULT = 0.5;

// Weight blend — must sum to 1.
const W_CLOUT = 0.35;
const W_CATEGORY = 0.35;
const W_CLOSENESS = 0.2;
const W_TRUST = 0.1;

const TIER_SCORE: Record<ClosenessTier, number> = {
  inner: 1.0,
  regular: 0.75,
  outer: 0.5,
};
const PUBLIC_CLOSENESS = 0.3;

// Learning rates (per graded outcome).
const GOOD_ALIGNED_SAGE = 4; // toward 100, diminishing
const GOOD_MISALIGNED_SAGE = -1;
const BAD_ALIGNED_SAGE = -3;
const BAD_MISALIGNED_SAGE = 2; // right dissent is rewarded
const CLOUT_STEP = 1;
const TRUST_STEP = 0.08;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function getCategorySage(user: User, category: Category): number {
  return user.categorySage[category] ?? SAGE_DEFAULT;
}

export function getPairTrust(asker: User, voterId: string): number {
  return asker.pairTrust[voterId] ?? TRUST_DEFAULT;
}

/** Best shared-Nest closeness between asker and voter, else public floor. */
export function closeness(askerId: string, voterId: string, nests: Nest[]): number {
  let best = 0;
  for (const nest of nests) {
    const hasAsker =
      nest.ownerId === askerId || nest.members.some((m) => m.userId === askerId);
    if (!hasAsker) continue;
    const membership = nest.members.find((m) => m.userId === voterId);
    const tier =
      membership?.tier ?? (nest.ownerId === voterId ? ('inner' as ClosenessTier) : undefined);
    if (tier) best = Math.max(best, TIER_SCORE[tier]);
  }
  return best > 0 ? best : PUBLIC_CLOSENESS;
}

/**
 * A voter's weight on an asker's SURV in a category. Range ~0.1–1.0;
 * displayed to users as 1–10 for legibility (like the 2011 votes.weight column).
 */
export function voterWeight(voter: User, asker: User, category: Category, nests: Nest[]): number {
  const w =
    W_CLOUT * (voter.clout / 100) +
    W_CATEGORY * (getCategorySage(voter, category) / 100) +
    W_CLOSENESS * closeness(asker.id, voter.id, nests) +
    W_TRUST * getPairTrust(asker, voter.id);
  return Math.round(w * 100) / 100;
}

export const displayWeight = (w: number) => Math.max(1, Math.round(w * 10));

/** Weighted tally — each option's SAGEmeter share. */
export function tally(surv: Surv): OptionTally[] {
  const totalWeight = surv.votes.reduce((s, v) => s + v.weight, 0);
  return surv.options.map((opt) => {
    const votes = surv.votes.filter((v) => v.optionId === opt.id);
    const weightSum = votes.reduce((s, v) => s + v.weight, 0);
    return {
      optionId: opt.id,
      label: opt.label,
      rawCount: votes.length,
      weightSum,
      pct: totalWeight > 0 ? Math.round((weightSum / totalWeight) * 1000) / 10 : 0,
    };
  });
}

export function winningOption(surv: Surv): OptionTally | undefined {
  const t = tally(surv);
  if (t.every((o) => o.rawCount === 0)) return undefined;
  return [...t].sort((a, b) => b.weightSum - a.weightSum)[0];
}

export interface SageDelta {
  userId: string;
  cloutDelta: number;
  categorySageDelta: number;
  trustDelta: number;
  aligned: boolean;
}

/**
 * The learning step. Called when the asker grades an acted-on SURV
 * (swipe right = good, left = bad). Returns per-voter deltas and mutates
 * copies of the affected users, plus the asker's pairTrust map.
 */
export function applyOutcome(
  surv: Surv,
  outcome: Outcome,
  users: Map<string, User>,
): SageDelta[] {
  if (!surv.actedOptionId) throw new Error('applyOutcome requires an acted-on SURV');
  const asker = users.get(surv.askerId);
  if (!asker) throw new Error(`unknown asker ${surv.askerId}`);

  const deltas: SageDelta[] = [];
  const seen = new Set<string>();

  for (const vote of surv.votes) {
    if (vote.userId === surv.askerId || seen.has(vote.userId)) continue;
    seen.add(vote.userId);
    const voter = users.get(vote.userId);
    if (!voter) continue;

    const aligned = vote.optionId === surv.actedOptionId;
    const current = getCategorySage(voter, surv.category);

    let sageDelta: number;
    let cloutDelta: number;
    let trustDelta: number;
    if (outcome === 'good') {
      // Diminishing returns as SAGE approaches 100.
      sageDelta = aligned ? GOOD_ALIGNED_SAGE * ((100 - current) / 70) : GOOD_MISALIGNED_SAGE;
      cloutDelta = aligned ? CLOUT_STEP : 0;
      trustDelta = aligned ? TRUST_STEP : -TRUST_STEP / 2;
    } else {
      sageDelta = aligned ? BAD_ALIGNED_SAGE : BAD_MISALIGNED_SAGE;
      cloutDelta = aligned ? -CLOUT_STEP : CLOUT_STEP;
      trustDelta = aligned ? -TRUST_STEP : TRUST_STEP;
    }

    voter.categorySage[surv.category] = clamp(Math.round((current + sageDelta) * 10) / 10, 1, 100);
    voter.clout = clamp(voter.clout + cloutDelta, 1, 100);
    asker.pairTrust[voter.id] = clamp(getPairTrust(asker, voter.id) + trustDelta, 0, 1);

    deltas.push({
      userId: voter.id,
      cloutDelta,
      categorySageDelta: sageDelta,
      trustDelta,
      aligned,
    });
  }

  // Asker earns clout for closing the loop — keeps the flywheel spinning.
  asker.clout = clamp(asker.clout + CLOUT_STEP, 1, 100);
  return deltas;
}

/**
 * Self-training: you helped a stranger decide in the public arena. If you
 * backed the option they acted on and it went well, your sage grows — the
 * path from Hatchling to Super Sage runs through good advice at scale.
 */
export function applyArenaResult(
  me: User,
  category: Category,
  aligned: boolean,
  outcome: Outcome,
): { cloutDelta: number; sageDelta: number } {
  const cur = getCategorySage(me, category);
  let sageDelta: number;
  let cloutDelta: number;
  if (outcome === 'good') {
    sageDelta = aligned ? 3 * ((100 - cur) / 70) : -0.5;
    cloutDelta = aligned ? 1 : 0;
  } else {
    sageDelta = aligned ? -2 : 1.5;
    cloutDelta = aligned ? -1 : 1;
  }
  me.categorySage[category] = clamp(Math.round((cur + sageDelta) * 10) / 10, 1, 100);
  me.clout = clamp(me.clout + cloutDelta, 1, 100);
  return { cloutDelta, sageDelta };
}

export function msRemaining(surv: Surv, now = Date.now()): number {
  return Math.max(0, surv.expiresAt - now);
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Expired';
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hrs = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return `${days} d: ${hrs} hrs`;
  if (hrs > 0) return `${hrs} hrs: ${m} min`;
  return `${m} min`;
}
