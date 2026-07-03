// Engine tests: weighting, weighted tallies, and the outcome-learning loop.
// Run: npm test  (npx tsx src/engine/sage.test.ts)

import assert from 'node:assert/strict';
import { buildDrafts, categoryQuestion, timeContext } from './drafts';
import { currentActivity, parseIcs, upcomingEvents } from './schedule';
import { suggestConnections } from './connections';
import { smartCheck, smartScore } from './smart';
import { applyOutcome, formatRemaining, getPairTrust, tally, voterWeight, winningOption } from './sage';
import { detectCategory, suggestOptionsHeuristic, topInfluencer } from './suggest';
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

// ---- habit/schedule drafts ----

const wedNoon = new Date(2026, 6, 1, 12, 15); // Wednesday, lunch hour
const HOUR_MS = 3600_000;

function mkSurv(question: string, createdAt: number, category: Surv['category'] = 'Food'): Surv {
  return {
    id: `t_${createdAt}_${question.length}`,
    askerId: me.id,
    question,
    category,
    options: [{ id: 'a', label: 'A', source: 'user' }],
    audience: { kind: 'public' },
    createdAt,
    expiresAt: createdAt + HOUR_MS,
    status: 'graded',
    votes: [],
  };
}

test('lunch draft appears at lunch hour', () => {
  assert.equal(timeContext(wedNoon).slot, 'midday');
  const drafts = buildDrafts([], me, wedNoon);
  assert.ok(drafts.some((d) => d.question.toLowerCase().includes('lunch')));
});

test('drafts suppress questions already asked today', () => {
  const asked = mkSurv('What should I grab for lunch?', wedNoon.getTime() - 2 * HOUR_MS);
  const drafts = buildDrafts([asked], me, wedNoon);
  assert.ok(!drafts.some((d) => d.question === 'What should I grab for lunch?'));
});

test('habits boost matching categories', () => {
  const foodHistory = [
    mkSurv('Old dinner question one', wedNoon.getTime() - 5 * 24 * HOUR_MS),
    mkSurv('Old dinner question two', wedNoon.getTime() - 3 * 24 * HOUR_MS),
  ];
  const plain = buildDrafts([], me, wedNoon).find((d) => d.question.includes('lunch'));
  const boosted = buildDrafts(foodHistory, me, wedNoon).find((d) => d.question.includes('lunch'));
  assert.ok(plain && boosted && boosted.score > plain.score);
});

test('recurring SURVs resurface as your usual', () => {
  const history = [
    mkSurv('Poker night — am I in?', wedNoon.getTime() - 8 * 24 * HOUR_MS, 'Entertainment'),
    mkSurv('Poker night — am I in?', wedNoon.getTime() - 1 * 24 * HOUR_MS, 'Entertainment'),
  ];
  const drafts = buildDrafts(history, me, wedNoon);
  const usual = drafts.find((d) => d.question === 'Poker night — am I in?');
  assert.ok(usual, 'recurring question should resurface');
  assert.ok(usual!.reason.includes('2×'));
});

// ---- ranked top-3 suggestions ----

test('suggestions return exactly top 3, ratings first', () => {
  const { options } = suggestOptionsHeuristic('Where should we eat dinner?', me, 3, { users, nests });
  assert.equal(options.length, 3);
  assert.ok(options[0].why?.includes('★'), 'top pick should carry a rating');
});

test('your strongest sage gets named attribution on the top pick', () => {
  const inf = topInfluencer(me, 'Food', { users, nests });
  assert.equal(inf?.user.id, linda.id); // Food sage 81, shares the Foodies nest
  const { options } = suggestOptionsHeuristic('Where should we eat dinner?', me, 3, { users, nests });
  assert.ok(options[0].why?.includes('Linda'), `expected attribution, got: ${options[0].why}`);
});

// ---- schedule + calendar integration ----

test('the general-public routine knows what you are doing', () => {
  assert.equal(currentActivity(new Date(2026, 6, 1, 12, 30)), 'eat'); // Wed lunch
  assert.equal(currentActivity(new Date(2026, 6, 1, 10, 0)), 'work'); // Wed morning
  assert.equal(currentActivity(new Date(2026, 6, 1, 17, 30)), 'exercise'); // Wed 5:30pm (M/W/F)
  assert.equal(currentActivity(new Date(2026, 6, 1, 2, 0)), 'sleep');
  assert.equal(currentActivity(new Date(2026, 6, 4, 15, 0)), 'play'); // Sat afternoon
});

test('routine activity boosts matching draft categories', () => {
  const wedLunch = new Date(2026, 6, 1, 12, 15);
  const drafts = buildDrafts([], me, wedLunch);
  const lunch = drafts.find((d) => d.question.includes('lunch'));
  assert.ok(lunch && lunch.score >= 92, `eat window should boost Food drafts, got ${lunch?.score}`);
});

const SAMPLE_ICS = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'SUMMARY:Dinner with Sarah',
  'DTSTART:20260703T190000',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'SUMMARY:Quarterly review',
  'DTSTART;TZID=America/Chicago:20260710T100000',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

test('ics parsing extracts events from Google Calendar exports', () => {
  const events = parseIcs(SAMPLE_ICS);
  assert.equal(events.length, 2);
  assert.equal(events[0].title, 'Dinner with Sarah');
  assert.equal(new Date(events[0].start).getHours(), 19);
});

test('upcoming calendar events become high-priority drafts', () => {
  const now = new Date(2026, 6, 2, 12, 15); // Thu noon; dinner event is Fri 7pm
  const events = parseIcs(SAMPLE_ICS);
  assert.equal(upcomingEvents(events, now.getTime()).length, 1); // review is outside 72h
  const drafts = buildDrafts([], me, now, 4, events);
  const eventDraft = drafts.find((d) => d.question.includes('Dinner with Sarah'));
  assert.ok(eventDraft, 'calendar event should surface as a draft');
  assert.ok(eventDraft!.reason.includes('📅'));
  assert.equal(eventDraft!.category, 'Food'); // "Dinner" → Food
});

// ---- category-tap question generation ----

test('tapping a category drafts a time-aware, geolocated question', () => {
  const q = categoryQuestion('Food', [], new Date(2026, 6, 1, 12, 15), 'Evanston');
  assert.ok(q.toLowerCase().includes('lunch'), `expected lunch question, got: ${q}`);
  assert.ok(q.includes('Evanston'), 'city should localize the question');
  const evening = categoryQuestion('Food', [], new Date(2026, 6, 1, 19, 0), null);
  assert.ok(evening.toLowerCase().includes('dinner'));
});

test('your recurring question beats the template (learned habit)', () => {
  const history = [
    mkSurv('Who should I start at flex this week?', 1000, 'Sports'),
    mkSurv('Who should I start at flex this week?', 2000, 'Sports'),
  ];
  const q = categoryQuestion('Sports', history, new Date(2026, 6, 1, 12, 0), null);
  assert.equal(q, 'Who should I start at flex this week?');
});

// ---- geolocated suggestions ----

test('real nearby places outrank mocks and carry distance', () => {
  const ctx = {
    users,
    nests,
    city: 'Evanston',
    placesByCategory: {
      Food: [
        { name: 'Napolita Pizzeria', distanceKm: 0.4 },
        { name: 'Ruby of Siam', distanceKm: 0.9 },
        { name: 'Dengeos Skokie', distanceKm: 1.6 },
      ],
    },
  };
  const { options } = suggestOptionsHeuristic('Where should we eat dinner tonight?', me, 3, ctx);
  assert.equal(options.length, 3);
  assert.equal(options[0].label, 'Napolita Pizzeria');
  assert.equal(options[0].source, 'places');
  assert.ok(options[0].why?.includes('mi away') && options[0].why?.includes('Evanston'));
  assert.ok(options.every((o) => o.source === 'places'), 'real places should displace mocks');
});

// ---- SMART framing ----

test('smartCheck lights up for a well-formed decision', () => {
  const options = [
    { id: 'a', label: 'Napolita Pizzeria', source: 'places' as const },
    { id: 'b', label: 'Cook at home', source: 'ai' as const },
    { id: 'c', label: 'Ruby of Siam', source: 'places' as const },
  ];
  const check = smartCheck('Dinner tonight near Evanston — where should I go?', 'Food', options, 3600_000);
  assert.equal(smartScore(check), 5, `expected full SMART, got ${JSON.stringify(check)}`);
});

test('smartCheck flags vague, timeless questions', () => {
  const check = smartCheck('Thoughts on general stuff in the future sometime?', 'Food', [], 168 * 3600_000);
  assert.ok(!check.M && !check.T, 'no options and no timeframe should fail M and T');
});

// ---- cross-platform connection discovery ----

test('people you may know: platform overlap ranks first, nest members excluded', () => {
  const sugg = suggestConnections(me, users, nests);
  const names = sugg.map((s) => s.user.name);
  assert.ok(names.includes('Chang Hee Kim') && names.includes('Thomas Kim'));
  assert.ok(!names.includes('Mike Lemke'), 'nest members must not be suggested');
  const chang = sugg.find((s) => s.user.name === 'Chang Hee Kim')!;
  assert.ok(chang.sharedPlatforms.includes('yelp'));
  assert.ok(chang.reason.includes('Yelp'));
  for (let i = 1; i < sugg.length; i++) {
    assert.ok(
      sugg[i - 1].sharedPlatforms.length >= sugg[i].sharedPlatforms.length,
      'sorted by overlap',
    );
  }
});

console.log(`\nSAGE engine: ${passed} tests passed`);
