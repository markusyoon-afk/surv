// SMART framing: every SURV should be a Specific, Measurable, Achievable,
// Relevant, Time-bound decision — actionable and social, not a vague poll.

import { detectCategory } from './suggest';
import type { Category, SurvOption } from './types';

export interface SmartCheck {
  S: boolean; // Specific — a concrete, focused question
  M: boolean; // Measurable — enough distinct options that the vote decides
  A: boolean; // Achievable — options are concrete actions, not essays
  R: boolean; // Relevant — question matches its category
  T: boolean; // Time-bound — countdown is short or the question names a timeframe
}

const HOUR = 3600_000;

const TIME_WORDS =
  /\b(tonight|today|tomorrow|this (week|month|weekend|morning|afternoon|evening)|by (friday|monday|tuesday|wednesday|thursday|saturday|sunday|end of day|eod)|right now|asap|this year)\b/i;

export function smartCheck(
  question: string,
  category: Category,
  options: SurvOption[],
  durationMs: number,
): SmartCheck {
  const q = question.trim();
  return {
    S: q.length >= 18 && /\?/.test(q + '?'),
    M: options.length >= 2,
    A: options.length > 0 && options.every((o) => o.label.length > 0 && o.label.length <= 70),
    R: detectCategory(q) === category || q.length < 18, // don't punish until they've typed
    T: TIME_WORDS.test(q) || durationMs <= 24 * HOUR,
  };
}

export function smartScore(check: SmartCheck): number {
  return [check.S, check.M, check.A, check.R, check.T].filter(Boolean).length;
}

export const SMART_LABELS: Array<[keyof SmartCheck, string]> = [
  ['S', 'Specific'],
  ['M', 'Measurable'],
  ['A', 'Achievable'],
  ['R', 'Relevant'],
  ['T', 'Time-bound'],
];
