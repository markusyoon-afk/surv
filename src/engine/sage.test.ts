// Engine tests: weighting, weighted tallies, and the outcome-learning loop.
// Run: npm test  (npx tsx src/engine/sage.test.ts)

import assert from 'node:assert/strict';
import { applyOutcome, formatRemaining, getPairTrust, tally, voterWeight, winningOption } from './sage';
import { detectCategory, suggestOptionsHeuristic } from './suggest';
import { seedNests, seedUsers } from './seed';
import type { Surv, User } from './types';

const users = seedUsers();
const nests = seedNests();
const byId = new Map(users.map((u) => [u.id, u]));
const me = byId.get('u_markus')!;
const linda = byId.get('u_linda')!; // Food sage 81, in my Foodies nest
const dan = byId.get('u_dan')!; // no Food sage, outer-ish

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

test('detectCategory maps everyday questions', () => {
  assert.equal(detectCategory('Where should we eat dinner tonight?'), 'Food');
  assert.equal(detectCategory('Should I buy the new laptop?'), 'Shopping');
  assert.equal(detectCategory('Which movie should we watch?'), 'Entertainment');
});

test('food sage in your nest outweighs a casual public voter', () => {
  const wLinda = voterWeight(linda, me, 'Food', nests);
  const wDan = voterWeight(dan, me, 'Food', nests);
  assert.ok(wLinda > wDan, `expected ${wLinda} > ${wDan}`);
});

test('weighted tally lets expertise beat raw counts', () => {
  const surv: Surv = {
    id: 't1',
    askerId: me.id,
    question: 'Dinner?',
    category: 'Food',
    options: [
      { id: 'a', label: 'Thai', source: 'user' },
      { id: 'b', label: 'Pizza', source: 'user' },
    ],
    audience: { kind: 'public' },
    createdAt: 0,
    expiresAt: 1,
    status: 'live',
    votes: [
      { userId: linda.id, optionId: 'a', weight: 0.8, votedAt: 0 },
      { userId: 'x1', optionId: 'b', weight: 0.3, votedAt: 0 },
      { userId: 'x2', optionId: 'b', weight: 0.3, votedAt: 0 },
    ],
  };
  const result = tally(surv);
  const thai = result.find((r) => r.optionId === 'a')!;
  const pizza = result.find((r) => r.optionId === 'b')!;
  assert.equal(thai.rawCount, 1);
  assert.equal(pizza.rawCount, 2);
  assert.ok(thai.pct > pizza.pct, 'one sage vote should outweigh two casual votes');
  assert.equal(winningOption(surv)!.optionId, 'a');
});

function makeActedSurv(): { surv: Surv; copies: Map<string, User> } {
  const surv: Surv = {
    id: 't2',
    askerId: me.id,
    question: 'Which bike?',
    category: 'Shopping',
    options: [
      { id: 'hybrid', label: 'Hybrid', source: 'ai' },
      { id: 'road', label: 'Road', source: 'user' },
    ],
    audience: { kind: 'public' },
    createdAt: 0,
    expiresAt: 1,
    status: 'acted',
    actedOptionId: 'hybrid',
    votes: [
      { userId: linda.id, optionId: 'hybrid', weight: 0.6, votedAt: 0 },
      { userId: dan.id, optionId: 'road', weight: 0.4, votedAt: 0 },
    ],
  };
  const copies = new Map(
    seedUsers().map((u) => [u.id, { ...u, categorySage: { ...u.categorySage }, pairTrust: { ...u.pairTrust } }]),
  );
  return { surv, copies };
}

test('good outcome boosts aligned voters and pair trust', () => {
  const { surv, copies } = makeActedSurv();
  const before = copies.get(linda.id)!.categorySage.Shopping ?? 30;
  const trustBefore = getPairTrust(copies.get(me.id)!, linda.id);
  const deltas = applyOutcome(surv, 'good', copies);

  const lindaDelta = deltas.find((d) => d.userId === linda.id)!;
  assert.ok(lindaDelta.aligned && lindaDelta.categorySageDelta > 0);
  assert.ok((copies.get(linda.id)!.categorySage.Shopping ?? 0) > before);
  assert.ok(getPairTrust(copies.get(me.id)!, linda.id) > trustBefore);

  const danDelta = deltas.find((d) => d.userId === dan.id)!;
  assert.ok(!danDelta.aligned && danDelta.categorySageDelta < 0);
});

test('bad outcome rewards the dissenter who warned you', () => {
  const { surv, copies } = makeActedSurv();
  const danBefore = copies.get(dan.id)!.categorySage.Shopping ?? 30;
  const deltas = applyOutcome(surv, 'bad', copies);

  const lindaDelta = deltas.find((d) => d.userId === linda.id)!;
  const danDelta = deltas.find((d) => d.userId === dan.id)!;
  assert.ok(lindaDelta.categorySageDelta < 0, 'backed a bad call → loses sage');
  assert.ok(danDelta.categorySageDelta > 0, 'right dissent → gains sage');
  assert.ok((copies.get(dan.id)!.categorySage.Shopping ?? 0) > danBefore);
});

test('asker earns clout for closing the loop', () => {
  const { surv, copies } = makeActedSurv();
  const before = copies.get(me.id)!.clout;
  applyOutcome(surv, 'good', copies);
  assert.equal(copies.get(me.id)!.clout, before + 1);
});

test('connector-enriched suggestions for food questions', () => {
  const { category, options } = suggestOptionsHeuristic('Where should we eat dinner?', me, 3);
  assert.equal(category, 'Food');
  assert.equal(options.length, 3);
  assert.ok(options.some((o) => o.source === 'yelp'), 'yelp connector should contribute');
});

test('countdown formatting matches the beta tooltip style', () => {
  assert.equal(formatRemaining(20 * 3600_000 + 59 * 60_000), '20 hrs: 59 min');
  assert.equal(formatRemaining(0), 'Expired');
});

console.log(`\nSAGE engine: ${passed} tests passed`);
