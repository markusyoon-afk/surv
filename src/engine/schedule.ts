// The rhythm layer of the decision engine: a general-public routine model
// (work / play / eat / sleep / exercise) plus real calendar events imported
// from Google Calendar / iCal (.ics), feeding scheduled decision drafts.

export type Activity = 'work' | 'play' | 'eat' | 'sleep' | 'exercise';

export interface RoutineBlock {
  activity: Activity;
  /** days of week, 0 = Sunday */
  days: number[];
  startHour: number;
  endHour: number; // exclusive
}

const WEEKDAYS = [1, 2, 3, 4, 5];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKEND = [0, 6];

/** The general-public default rhythm. Earlier blocks win when they overlap. */
export const DEFAULT_ROUTINE: RoutineBlock[] = [
  { activity: 'eat', days: ALL_DAYS, startHour: 7, endHour: 9 },
  { activity: 'eat', days: ALL_DAYS, startHour: 12, endHour: 14 },
  { activity: 'eat', days: ALL_DAYS, startHour: 18, endHour: 20 },
  { activity: 'exercise', days: [1, 3, 5], startHour: 17, endHour: 18 },
  { activity: 'work', days: WEEKDAYS, startHour: 9, endHour: 17 },
  { activity: 'play', days: ALL_DAYS, startHour: 20, endHour: 23 },
  { activity: 'play', days: WEEKEND, startHour: 10, endHour: 18 },
  { activity: 'sleep', days: ALL_DAYS, startHour: 23, endHour: 24 },
  { activity: 'sleep', days: ALL_DAYS, startHour: 0, endHour: 7 },
];

export function currentActivity(now: Date = new Date(), routine = DEFAULT_ROUTINE): Activity | null {
  const day = now.getDay();
  const hour = now.getHours();
  for (const block of routine) {
    if (block.days.includes(day) && hour >= block.startHour && hour < block.endHour) {
      return block.activity;
    }
  }
  return null;
}

// ---- iCal / .ics import (Google Calendar, Apple Calendar, Outlook all export this) ----

export interface CalEvent {
  id: string;
  title: string;
  start: number; // epoch ms
}

/** Minimal RFC 5545 parser: unfolds lines, extracts SUMMARY + DTSTART per VEVENT. */
export function parseIcs(text: string): CalEvent[] {
  // Unfold: lines beginning with space/tab continue the previous line.
  const unfolded = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  const events: CalEvent[] = [];
  let inEvent = false;
  let title = '';
  let start: number | null = null;

  for (const line of unfolded.split('\n')) {
    const upper = line.toUpperCase();
    if (upper.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      title = '';
      start = null;
    } else if (upper.startsWith('END:VEVENT')) {
      if (inEvent && title && start !== null) {
        events.push({ id: `${start}_${title.slice(0, 40)}`, title, start });
      }
      inEvent = false;
    } else if (inEvent) {
      if (upper.startsWith('SUMMARY')) {
        title = line.slice(line.indexOf(':') + 1).replace(/\\,/g, ',').replace(/\\n/g, ' ').trim();
      } else if (upper.startsWith('DTSTART')) {
        start = parseIcsDate(line.slice(line.indexOf(':') + 1).trim());
      }
    }
  }
  return events.sort((a, b) => a.start - b.start);
}

function parseIcsDate(value: string): number | null {
  // 20260704 (all-day) or 20260704T190000 (local) or 20260704T190000Z (UTC)
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = '9', mi = '0', s = '0', z] = m;
  if (z) return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  return new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime();
}

export function upcomingEvents(
  events: CalEvent[],
  now = Date.now(),
  windowMs = 72 * 3600_000,
): CalEvent[] {
  return events.filter((e) => e.start > now && e.start <= now + windowMs).slice(0, 8);
}

export function whenLabel(start: number, now = Date.now()): string {
  const days = Math.floor((start - new Date(now).setHours(0, 0, 0, 0)) / (24 * 3600_000));
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return new Date(start).toLocaleDateString(undefined, { weekday: 'long' });
}
