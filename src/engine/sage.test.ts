// Engine tests: weighting, weighted tallies, and the outcome-learning loop.
// Run: npm test  (npx tsx src/engine/sage.test.ts)

import assert from 'node:assert/strict';
import { activeArenaSurvs, arenaResult, arenaStats } from './arena';
import { buildDrafts, categoryQuestion, eventDraftContent, timeContext } from './drafts';
import { adviseOption, advisorRationale, getPopulation, makeAvatar, pickAdvisor, POPULATION_SIZE } from './population';
import { currentActivity, parseIcs, upcomingEvents } from './schedule';
import { suggestConnections } from './connections';
import { buildDigest } from './digest';
import { TRENDING_SURVS } from './trending';
import { smartCheck, smartScore } from './smart';
import { applyArenaResult, applyOutcome, formatRemaining, getPairTrust, tally, voterWeight, winningOption } from './sage';
import { detectCategory, detectMeal, placeFitsMeal, suggestOptionsHeuristic, topInfluencer } from './suggest';
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
  assert.ok(names.includes('Chang Hee Kim') && names.includes('Mike Lemke'));
  assert.ok(
    !names.includes('Linda Chang') && !names.includes('Joseph Yoon'),
    'nest members must not be suggested',
  );
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

// ---- nest activity digest ----

test('digest surfaces due decisions, fresh votes, and your oracle', () => {
  const now = Date.now();
  const digestSurvs: Surv[] = [
    { ...mkSurv('Old choice A', now - 3 * 24 * 3600_000, 'Shopping'), status: 'acted', actedOptionId: 'a' },
    {
      ...mkSurv('Live one', now - 3600_000, 'Food'),
      status: 'live',
      votes: [{ userId: linda.id, optionId: 'a', weight: 0.7, votedAt: now - 1800_000 }],
    },
    {
      ...mkSurv('Closed well', now - 5 * 24 * 3600_000, 'Food'),
      status: 'graded',
      outcome: 'good',
      gradedAt: now - 2 * 24 * 3600_000,
    },
  ];
  const items = buildDigest(me, users, nests, digestSurvs, now);
  const all = items.map((i) => i.text).join(' | ');
  assert.ok(all.includes('decision waiting on you'), `due missing: ${all}`);
  assert.ok(all.includes('new vote') && all.includes('Linda'), `votes missing: ${all}`);
  assert.ok(all.includes('closed 1 decision'), `graded missing: ${all}`);
  assert.ok(all.includes('Linda is your top sage') || all.includes('top sage'), `oracle missing: ${all}`);
});

test('digest is quiet when nothing happened', () => {
  const items = buildDigest(me, users, nests, [], Date.now());
  // only the oracle line can appear with no activity
  assert.ok(items.length <= 1, `expected quiet digest, got ${items.map((i) => i.text).join(' | ')}`);
});

// ---- trending SURVs: SMART by construction (framing enforced here, not in UI) ----

test('all top-5 trending SURVs are fully SMART', () => {
  assert.equal(TRENDING_SURVS.length, 5);
  for (const t of TRENDING_SURVS) {
    const opts = t.options.map((label, i) => ({ id: `o${i}`, label, source: 'nest' as const }));
    const check = smartCheck(t.question, t.category, opts, t.durationMs);
    assert.equal(
      smartScore(check),
      5,
      `"${t.question}" is not fully SMART: ${JSON.stringify(check)}`,
    );
  }
});

test('rejected labels never come back in suggestions', () => {
  const first = suggestOptionsHeuristic('Where should we eat dinner tonight?', me, 3, { users, nests });
  const rejectedLabel = first.options[0].label;
  const second = suggestOptionsHeuristic('Where should we eat dinner tonight?', me, 3, {
    users,
    nests,
    excludeLabels: [rejectedLabel],
  });
  assert.ok(
    !second.options.some((o) => o.label === rejectedLabel),
    `"${rejectedLabel}" should have been excluded`,
  );
  assert.ok(second.options.length > 0, 'replacements still generated');
});

// ---- the AI population + public arena ----

test('population: 100,000 virtual avatars, deterministic and always learning', () => {
  assert.equal(POPULATION_SIZE, 100_000);
  const sample = getPopulation(200);
  assert.ok(sample.length >= 200 && sample.every((u) => u.isAI), 'sampled avatars are AI-labeled');
  // deterministic: same index → identical avatar (any index in the 100k)
  assert.deepEqual(makeAvatar(42), makeAvatar(42));
  assert.deepEqual(makeAvatar(99_999).id, 'ai_99999');
  const far = makeAvatar(87_654);
  assert.ok(far.name.includes(' ') && far.clout >= 30 && Object.keys(far.categorySage).length >= 2);
});

test('advisors are informed, not random: rated options win', () => {
  const options = [
    { id: 'a', label: 'Random spot', source: 'user' as const },
    { id: 'b', label: 'Ruby of Siam', source: 'yelp' as const, why: '4.5★ on Yelp near you' },
    { id: 'c', label: 'Lower rated', source: 'yelp' as const, why: '3.9★ on Yelp near you' },
  ];
  const advisor = pickAdvisor('Food', new Set(), 123);
  assert.ok((advisor.categorySage.Food ?? 0) >= 55, 'advisor should be a category sage');
  const choice = adviseOption(advisor, options, 5);
  assert.equal(choice.id, 'b', 'highest-rated option should be chosen');
  const rationale = advisorRationale(advisor, 'Food', choice, 9);
  assert.ok(rationale.includes('Ruby of Siam') && rationale.includes('4.5★'), rationale);
});

test('arena: live SURVs stream deterministically with badges and stats', () => {
  const now = 1_800_000_000_000;
  const a = activeArenaSurvs(now);
  const b = activeArenaSurvs(now);
  assert.deepEqual(a.map((s) => s.id), b.map((s) => s.id), 'deterministic across calls');
  assert.ok(a.length >= 10, `expected a busy arena, got ${a.length}`);
  assert.ok(a[0].badges.includes('🏆 Top SURV'));
  assert.ok(a.every((s) => s.expiresAt > now && s.createdAt <= now));
  const stats = arenaStats(now);
  assert.ok(stats.newThisHour >= 1000, `1000+ new SURVs per hour, got ${stats.newThisHour}`);
  assert.ok(stats.liveNow > 3000 && stats.votesLastHour > 15000, 'a busy Forest');
});

test('arena outcomes settle deterministically after expiry', () => {
  const now = 1_800_000_000_000;
  const live = activeArenaSurvs(now)[0];
  assert.equal(arenaResult(live.id, now), null, 'no result while live');
  const later = live.expiresAt + 1;
  const result = arenaResult(live.id, later);
  assert.ok(result && result.actedIndex >= 0 && ['good', 'bad'].includes(result.outcome));
  assert.deepEqual(result, arenaResult(live.id, later), 'same result every time');
});

test('helping strangers decide well trains YOUR sage', () => {
  const you: User = { ...me, categorySage: { ...me.categorySage }, pairTrust: {} };
  const before = you.categorySage.Food ?? 30;
  const cloutBefore = you.clout;
  applyArenaResult(you, 'Food', true, 'good');
  assert.ok((you.categorySage.Food ?? 0) > before, 'aligned good call grows sage');
  assert.equal(you.clout, cloutBefore + 1);
  applyArenaResult(you, 'Food', true, 'bad');
  assert.ok(you.clout <= cloutBefore + 1, 'backing a bad call costs clout');
});

// ---- life-ecosystem proactive drafts ----

test('event type decides the question: housewarming asks what to bring', () => {
  const hw = eventDraftContent('Housewarming at the Kims', 'Saturday');
  assert.ok(hw.question.includes('what should I bring'), hw.question);
  assert.equal(hw.category, 'Shopping');
  assert.ok(hw.options && hw.options.some((o) => o.includes('wine')));

  const workout = eventDraftContent('Morning workout', 'tomorrow');
  assert.ok(workout.question.includes('focus'), workout.question);
  assert.equal(workout.category, 'Sports');

  const interview = eventDraftContent('Final interview — Acme', 'tomorrow');
  assert.ok(interview.question.includes('prep'), interview.question);
  assert.equal(interview.category, 'Work');

  const generic = eventDraftContent('Quarterly sync', 'today');
  assert.ok(generic.question.includes('plan'), 'unknown events fall back to the plan question');
});

test('health signals surface drafts only when connected', () => {
  const wedNoon = new Date(2026, 6, 1, 12, 15);
  const off = buildDrafts([], me, wedNoon, 6, [], false);
  const on = buildDrafts([], me, wedNoon, 6, [], true);
  assert.ok(!off.some((d) => d.reason.includes('health')), 'no health drafts while disconnected');
  assert.ok(on.some((d) => d.reason.includes('health')), 'health draft appears when connected');
});

// ---- meal-verified suggestions ----

const MEAL_PLACES = [
  { name: 'Inchin’s Bamboo Garden', distanceKm: 0.4, kind: 'restaurant', cuisine: 'chinese;indian' },
  { name: 'The Human Bean', distanceKm: 0.9, kind: 'cafe', cuisine: 'coffee_shop' },
  { name: 'Dunkin’', distanceKm: 1.1, kind: 'fast_food', cuisine: 'donut;coffee' },
  { name: 'Prairie Moon', distanceKm: 0.6, kind: 'restaurant' },
];

test('meal context is detected from the question', () => {
  assert.equal(detectMeal('Coffee run or brew at home?'), 'coffee');
  assert.equal(detectMeal('What’s for breakfast?'), 'breakfast');
  assert.equal(detectMeal('Lunch today — where should I eat?'), 'lunch');
  assert.equal(detectMeal('Dinner tonight — where should I go?'), 'dinner');
});

test('a coffee question never suggests a dinner house', () => {
  const { options } = suggestOptionsHeuristic('Coffee run or brew at home this morning?', me, 3, {
    users,
    nests,
    categoryHint: 'Food',
    placesByCategory: { Food: MEAL_PLACES },
  });
  const labels = options.map((o) => o.label);
  assert.ok(!labels.some((l) => l.includes('Inchin')), `dinner house leaked into coffee: ${labels}`);
  assert.ok(!labels.some((l) => l.includes('Prairie Moon')), `restaurant leaked into coffee: ${labels}`);
  assert.ok(labels.includes('The Human Bean') && labels.includes('Dunkin’'), `coffee venues expected: ${labels}`);
});

test('dinner questions skip cafes and donut shops', () => {
  const { options } = suggestOptionsHeuristic('Dinner tonight — where should I go?', me, 3, {
    users,
    nests,
    categoryHint: 'Food',
    placesByCategory: { Food: MEAL_PLACES },
  });
  const labels = options.map((o) => o.label);
  assert.ok(labels.some((l) => l.includes('Inchin') || l.includes('Prairie Moon')), `restaurants expected: ${labels}`);
  assert.ok(!labels.includes('The Human Bean') && !labels.includes('Dunkin’'), `cafe leaked into dinner: ${labels}`);
});

test('no verified venue → meal-appropriate fallbacks, not wrong restaurants', () => {
  const { options } = suggestOptionsHeuristic('Coffee run or brew at home?', me, 3, {
    users,
    nests,
    categoryHint: 'Food',
    placesByCategory: { Food: [MEAL_PLACES[0]] }, // only the dinner house nearby
  });
  const labels = options.map((o) => o.label);
  assert.ok(!labels.some((l) => l.includes('Inchin')), `dinner house leaked: ${labels}`);
  assert.ok(labels.includes('Brew at home'), `expected brew-at-home fallback: ${labels}`);
});

test('placeFitsMeal handles untagged venues by type', () => {
  assert.ok(!placeFitsMeal({ name: 'X', distanceKm: 1, kind: 'restaurant' }, 'coffee'));
  assert.ok(placeFitsMeal({ name: 'X', distanceKm: 1, kind: 'cafe' }, 'breakfast'));
  assert.ok(!placeFitsMeal({ name: 'X', distanceKm: 1, kind: 'cafe' }, 'dinner'));
  assert.ok(placeFitsMeal({ name: 'X', distanceKm: 1, kind: 'restaurant' }, 'lunch'));
});

console.log(`\nSAGE engine: ${passed} tests passed`);
