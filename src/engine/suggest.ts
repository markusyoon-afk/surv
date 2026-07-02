// Option auto-generation: category detection + connector enrichment + optional LLM pass.
// v1 ships with heuristic + mocked connectors; set EXPO_PUBLIC_ANTHROPIC_KEY to enable
// live Claude generation (see PRODUCT_SPEC.md §2).

import type { Category, SurvOption, User } from './types';

let optionSeq = 0;
const oid = () => `opt_${Date.now()}_${optionSeq++}`;

const CATEGORY_KEYWORDS: Array<[Category, RegExp]> = [
  ['Food', /\b(eat|lunch|dinner|restaurant|food|cook|takeout|brunch|snack|hungry)\b/i],
  ['Shopping', /\b(buy|purchase|gift|shop|deal|order)\b/i],
  ['Sports', /\b(game|team|play|workout|gym|run|basketball|golf|fantasy|start|bench)\b/i],
  ['Tech', /\b(phone|laptop|computer|app|tablet|tech|upgrade|gadget)\b/i],
  ['Travel', /\b(trip|vacation|travel|visit|flight|weekend away|hotel)\b/i],
  ['Style', /\b(wear|outfit|hair|shoes|dress|style)\b/i],
  ['Entertainment', /\b(watch|movie|show|concert|stream|series|film)\b/i],
  ['Work', /\b(work|job|career|boss|meeting|client|coworker|hire)\b/i],
  ['Relationships', /\b(friend|wife|husband|date|family|mom|dad|brother|sister|girlfriend|boyfriend)\b/i],
  ['Living', /\b(move|apartment|neighborhood|rent|house|home|budget)\b/i],
];

export function detectCategory(question: string): Category {
  for (const [category, re] of CATEGORY_KEYWORDS) {
    if (re.test(question)) return category;
  }
  return 'Living';
}

// ---- Mock connectors (replaced by real OAuth integrations in roadmap step 2) ----

const YELP_MOCK: Record<string, Array<{ name: string; rating: number }>> = {
  Food: [
    { name: 'Ruby of Siam', rating: 4.5 },
    { name: 'Dengeos', rating: 4.2 },
    { name: 'The new Thai place your Foodies keep posting', rating: 4.7 },
  ],
};

const GOOGLE_REVIEWS_MOCK: Record<string, Array<{ name: string; rating: number }>> = {
  Shopping: [
    { name: 'Costco (4.6★ near you)', rating: 4.6 },
    { name: 'Target (4.3★ near you)', rating: 4.3 },
  ],
};

const NEST_SIGNAL_MOCK: Partial<Record<Category, string[]>> = {
  Entertainment: ['The series your Discord has mentioned 12× this week'],
  Sports: ['Pickup run Saturday — your Hoops Crew is in'],
  Travel: ['The cabin trip your IG friends posted about'],
};

const GENERIC_TEMPLATES: Record<Category, string[]> = {
  Food: ['Cook what’s already in the fridge', 'Order the usual', 'Try somewhere new'],
  Shopping: ['Buy it now', 'Wait for a sale', 'Get the cheaper alternative'],
  Living: ['Go for it', 'Sleep on it a week', 'Ask your Nest in person first'],
  Entertainment: ['Stay in and stream', 'Go out for it', 'Save it for the weekend'],
  Sports: ['Play / start them', 'Sit this one out', 'Decide game-time'],
  Tech: ['Upgrade now', 'Wait for the next release', 'Buy refurbished'],
  Travel: ['Book it', 'Pick somewhere closer', 'Push it a month'],
  Style: ['Make the change', 'Keep it classic', 'Get a second opinion in person'],
  Work: ['Address it head-on', 'Give it two weeks', 'Loop in someone you trust'],
  Relationships: ['Reach out first', 'Give it space', 'Plan something together'],
};

/** Heuristic path: history + connectors + templates → up to `count` options. */
export function suggestOptionsHeuristic(
  question: string,
  user: User,
  count = 3,
): { category: Category; options: SurvOption[] } {
  const category = detectCategory(question);
  const options: SurvOption[] = [];

  if (user.connectors.includes('yelp')) {
    for (const hit of YELP_MOCK[category] ?? []) {
      options.push({ id: oid(), label: hit.name, source: 'yelp', why: `${hit.rating}★ on Yelp near you` });
    }
  }
  if (user.connectors.includes('google_reviews')) {
    for (const hit of GOOGLE_REVIEWS_MOCK[category] ?? []) {
      options.push({ id: oid(), label: hit.name, source: 'google_reviews', why: 'Top-rated on Google near you' });
    }
  }
  for (const signal of NEST_SIGNAL_MOCK[category] ?? []) {
    options.push({ id: oid(), label: signal, source: 'nest', why: 'Trending in your Nests' });
  }
  for (const template of GENERIC_TEMPLATES[category]) {
    if (options.length >= count) break;
    options.push({ id: oid(), label: template, source: 'ai', why: 'Based on your past SURVs' });
  }
  return { category, options: options.slice(0, count) };
}

/**
 * LLM path — calls the Claude API when a key is configured, otherwise falls back
 * to the heuristic engine. Kept isolated so the backend can own this later.
 */
export async function suggestOptions(
  question: string,
  user: User,
  count = 3,
): Promise<{ category: Category; options: SurvOption[] }> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_KEY;
  if (!apiKey || question.trim().length < 8) {
    return suggestOptionsHeuristic(question, user, count);
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content:
              `You generate decision options for SURV, a social decision app. ` +
              `The user asks: "${question}". ` +
              `Reply with JSON only: {"category": one of Food|Shopping|Living|Entertainment|Sports|Tech|Travel|Style|Work|Relationships, ` +
              `"options": [{"label": string (max 60 chars), "why": string (max 50 chars)}] with exactly ${count} distinct, concrete options}.`,
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}`);
    const data = await res.json();
    const text: string = data.content?.[0]?.text ?? '';
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    return {
      category: parsed.category ?? detectCategory(question),
      options: parsed.options.slice(0, count).map((o: { label: string; why?: string }) => ({
        id: oid(),
        label: o.label,
        source: 'ai' as const,
        why: o.why,
      })),
    };
  } catch {
    return suggestOptionsHeuristic(question, user, count);
  }
}
