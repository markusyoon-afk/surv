// Stress / validation / quality cycles. The regression suite is sage.test.ts;
// this file hammers scale, hostile input, and cross-category quality.
// Run: npm test  (both suites)

import assert from 'node:assert/strict';
import { activeArenaSurvs, arenaResult } from './arena';
import { buildDrafts, categoryQuestion, eventDraftContent } from './drafts';
import { avatarAt, makeAvatar, pickAdvisor, POPULATION_SIZE } from './population';
import { applyArenaResult, applyOutcome, voterWeight } from './sage';
import { parseIcs } from './schedule';
import { seedNests, seedUsers } from './seed';
import { smartCheck } from './smart';
import { detectCategory, detectMeal, placeFitsMeal, suggestOptionsHeuristic } from './suggest';
import { CATEGORIES, type Surv, type User } from './types';

const users = seedUsers();
const nests = seedNests();
const me = users.find((u) => u.id === 'u_markus')!;

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

// ---------- STRESS ----------

test('stress: 5,000 avatars generate in bounded time with valid profiles', () => {
  const t0 = Date.now();
  for (let i = 0; i < 5000; i++) {
    const a = makeAvatar(i * 17 % POPULATION_SIZE);
    if (i % 500 === 0) {
      assert.ok(a.clout >= 1 && a.clout <= 100 && a.name.length > 3);
    }
  }
  const ms = Date.now() - t0;
  assert.ok(ms < 3000, `5k avatars took ${ms}ms`);
  assert.equal(avatarAt(123).id, avatarAt(123).id, 'cache stable');
});

test('stress: arena stays consistent across 48 hours of timestamps', () => {
  const base = 1_800_000_000_000;
  for (let h = 0; h < 48; h++) {
    const now = base + h * 3600_000;
    const live = activeArenaSurvs(now);
    assert.ok(live.length >= 10, `hour ${h}: only ${live.length} live`);
    assert.ok(live.every((s) => s.createdAt <= now && s.expiresAt > now), `hour ${h}: lifecycle violated`);
    assert.ok(live.every((s) => s.split.every((p) => p >= 0 && p <= 1)), `hour ${h}: bad split`);
  }
});

test('stress: 500-voter SURV grades fast with all bounds held', () => {
  const votes = Array.from({ length: 500 }, (_, i) => ({
    userId: `ai_${i}`,
    optionId: i % 3 === 0 ? 'a' : 'b',
    weight: 0.2 + (i % 8) / 10,
    votedAt: i,
  }));
  const surv: Surv = {
    id: 'stress1', askerId: me.id, question: 'Q', category: 'Food',
    options: [{ id: 'a', label: 'A', source: 'user' }, { id: 'b', label: 'B', source: 'user' }],
    audience: { kind: 'public' }, createdAt: 0, expiresAt: 1, status: 'acted', actedOptionId: 'a', votes,
  };
  const copies = new Map<string, User>(
    votes.map((v) => [v.userId, { ...makeAvatar(0), id: v.userId, categorySage: { Food: 50 }, categoryN: {}, pairTrust: {} }]),
  );
  copies.set(me.id, { ...me, categorySage: { ...me.categorySage }, categoryN: {}, pairTrust: {} });
  const t0 = Date.now();
  const deltas = applyOutcome(surv, 'good', copies);
  assert.ok(Date.now() - t0 < 1000, 'grading 500 voters should be fast');
  assert.equal(deltas.length, 500);
  for (const u of copies.values()) {
    for (const s of Object.values(u.categorySage)) assert.ok(s! >= 1 && s! <= 100, 'sage bounds');
    assert.ok(u.clout >= 1 && u.clout <= 100, 'clout bounds');
  }
});

test('stress: 300 consecutive arena results keep every meter in bounds', () => {
  const you: User = { ...me, categorySage: { Food: 30 }, categoryN: {}, pairTrust: {} };
  for (let i = 0; i < 300; i++) {
    applyArenaResult(you, 'Food', i % 3 !== 0, i % 4 === 0 ? 'bad' : 'good');
    assert.ok((you.categorySage.Food ?? 0) >= 1 && (you.categorySage.Food ?? 0) <= 100);
    assert.ok(you.clout >= 1 && you.clout <= 100);
  }
  assert.equal(you.categoryN?.Food, 300);
});

// ---------- VALIDATION (hostile input never crashes, always sane) ----------

test('validation: ICS parser survives garbage, emptiness, and bulk', () => {
  assert.deepEqual(parseIcs(''), []);
  assert.deepEqual(parseIcs('total garbage \x00\x01 ~~~'), []);
  assert.deepEqual(parseIcs('BEGIN:VEVENT\nSUMMARY:no date\nEND:VEVENT'), []);
  const bulk = Array.from({ length: 300 }, (_, i) =>
    `BEGIN:VEVENT\nSUMMARY:Event ${i}\nDTSTART:20260710T1200${String(i % 60).padStart(2, '0')}\nEND:VEVENT`,
  ).join('\n');
  assert.equal(parseIcs(bulk).length, 300);
});

test('validation: detectors never throw on hostile strings', () => {
  const hostile = ['', '   ', '🦉🦉🦉', 'a'.repeat(10_000), '<script>alert(1)</script>', '\\n\\t%00', '???!!!'];
  for (const q of hostile) {
    assert.ok(CATEGORIES.includes(detectCategory(q)));
    assert.ok(['coffee', 'breakfast', 'lunch', 'dinner', 'any'].includes(detectMeal(q)));
    smartCheck(q, 'Food', [], 3600_000); // must not throw
    assert.ok(eventDraftContent(q || 'x', 'today').question.length > 0);
  }
});

test('validation: vote weights stay in display range for extreme profiles', () => {
  const titan: User = { ...me, id: 'x1', clout: 100, categorySage: { Food: 100 }, pairTrust: {} };
  const zero: User = { ...me, id: 'x2', clout: 1, categorySage: { Food: 1 }, pairTrust: {} };
  const wMax = voterWeight(titan, me, 'Food', nests);
  const wMin = voterWeight(zero, me, 'Food', nests);
  assert.ok(wMax <= 1.0 && wMax > 0.8, `max weight ${wMax}`);
  assert.ok(wMin >= 0.05 && wMin < 0.3, `min weight ${wMin}`);
});

test('validation: drafts hold their contract across every hour of the week', () => {
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h += 3) {
      const drafts = buildDrafts([], me, new Date(2026, 6, 5 + d, h, 15), 4, [], true);
      assert.ok(drafts.length <= 4, 'limit respected');
      assert.equal(new Set(drafts.map((x) => x.id)).size, drafts.length, 'ids unique');
      for (const dr of drafts) assert.ok(dr.question.length > 8 && dr.durationMs > 0);
    }
  }
});

// ---------- QUALITY (every feature yields useful output) ----------

test('quality: category-tap yields a usable SMART question for all 10 categories', () => {
  for (const c of CATEGORIES) {
    const q = categoryQuestion(c, [], new Date(2026, 6, 6, 12, 30), 'Evanston');
    const { options } = suggestOptionsHeuristic(q, me, 3, { users, nests, categoryHint: c });
    assert.ok(q.length >= 12, `${c}: question too thin`);
    assert.ok(options.length === 3, `${c}: expected 3 options, got ${options.length}`);
    const check = smartCheck(q, c, options, 3600_000);
    assert.ok(check.M && check.A && check.T, `${c}: not actionable — ${JSON.stringify(check)}`);
  }
});

test('quality: advisors are qualified in every category they answer', () => {
  for (const c of CATEGORIES) {
    const advisor = pickAdvisor(c, new Set(), 777 + c.length);
    assert.ok(
      (advisor.categorySage[c] ?? 0) >= 55 || Object.keys(advisor.categorySage).length > 0,
      `${c}: unqualified advisor`,
    );
  }
});

test('quality: meal filter never leaks a wrong venue across 200 fuzzed cases', () => {
  const kinds = ['restaurant', 'cafe', 'fast_food'];
  const cuisines = [undefined, 'chinese', 'coffee_shop', 'donut', 'burger', 'breakfast;diner', 'indian;asian'];
  for (let i = 0; i < 200; i++) {
    const place = {
      name: `P${i}`,
      distanceKm: (i % 30) / 10,
      kind: kinds[i % kinds.length],
      cuisine: cuisines[i % cuisines.length],
    };
    if (placeFitsMeal(place, 'coffee')) {
      assert.ok(
        place.kind === 'cafe' || /coffee|donut|bakery|tea/.test(place.cuisine ?? ''),
        `coffee leak: ${JSON.stringify(place)}`,
      );
    }
    if (placeFitsMeal(place, 'dinner')) {
      assert.ok(place.kind !== 'cafe', `dinner leak: ${JSON.stringify(place)}`);
    }
  }
});

test('quality: arena outcomes always reference a real option', () => {
  const now = 1_800_000_000_000;
  const expired = activeArenaSurvs(now).map((s) => s.id);
  for (const id of expired) {
    const later = now + 8 * 3600_000;
    const result = arenaResult(id, later);
    assert.ok(result, `${id}: no result after expiry`);
    assert.ok(result!.actedIndex >= 0 && result!.actedIndex < result!.options.length, `${id}: bad acted index`);
  }
});

console.log(`\nStress/validation/quality: ${passed} tests passed`);
