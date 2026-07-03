// The interactive calendar: a week strip + day schedule where every block is
// live. Tap a real calendar event or a routine block → see the SURV it drafts
// → 🕊️ post it straight to your Tree or open it in the composer.

import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ACTIVITY_LABEL, eventDraftContent, routineDraft, type SurvDraft } from '../engine/drafts';
import { DEFAULT_ROUTINE, whenLabel, type Activity, type CalEvent } from '../engine/schedule';
import { useSurv } from '../engine/store';
import { colors, radius } from '../theme';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

interface Row {
  key: string;
  startHour: number;
  timeLabel: string;
  title: string;
  kind: 'event' | 'routine';
  draft: SurvDraft;
}

const hourLabel = (h: number) => {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${h < 12 ? 'a' : 'p'}`;
};

export function CalendarBoard({ onDraft }: { onDraft: (draft: SurvDraft) => void }) {
  const { me, survs, calendarEvents, geo, quickPostDraft } = useSurv();
  const [selected, setSelected] = useState(0); // day offset from today
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [postedRow, setPostedRow] = useState<string | null>(null);

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const mySurvs = useMemo(() => survs.filter((s) => s.askerId === me.id), [survs, me.id]);

  const days = [...Array(7)].map((_, i) => new Date(todayStart + i * DAY));
  const eventsOn = (dayStart: number): CalEvent[] =>
    calendarEvents
      .filter((e) => e.start >= dayStart && e.start < dayStart + DAY)
      .sort((a, b) => a.start - b.start);

  const selectedDay = days[selected];
  const rows: Row[] = useMemo(() => {
    const dayStart = selectedDay.getTime();
    const out: Row[] = [];
    for (const e of eventsOn(dayStart)) {
      const at = new Date(e.start);
      const content = eventDraftContent(e.title, whenLabel(e.start));
      out.push({
        key: `ev_${e.id}`,
        startHour: at.getHours(),
        timeLabel: at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
        title: e.title,
        kind: 'event',
        draft: {
          id: `d_cal_${e.id.replace(/[^a-z0-9]/gi, '_').slice(0, 40)}`,
          question: content.question,
          category: content.category,
          reason: `📅 On your calendar ${whenLabel(e.start)}`,
          durationMs: Math.min(Math.max(e.start - Date.now() - HOUR, HOUR), 8 * HOUR),
          score: 95,
          options: content.options,
        },
      });
    }
    const weekday = selectedDay.getDay();
    const seen = new Set<Activity>();
    for (const block of DEFAULT_ROUTINE) {
      if (!block.days.includes(weekday) || seen.has(block.activity)) continue;
      if (block.activity === 'sleep' && block.startHour === 0) continue; // one wind-down row is enough
      seen.add(block.activity);
      const at = new Date(selectedDay);
      at.setHours(block.startHour);
      out.push({
        key: `rt_${block.activity}_${block.startHour}`,
        startHour: block.startHour,
        timeLabel: `${hourLabel(block.startHour)}–${hourLabel(block.endHour)}`,
        title: `${ACTIVITY_LABEL[block.activity]} block`,
        kind: 'routine',
        draft: routineDraft(block.activity, mySurvs, at, geo?.city),
      });
    }
    return out.sort((a, b) => a.startHour - b.startHour);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, calendarEvents, mySurvs, geo?.city, todayStart]);

  const post = (row: Row) => {
    quickPostDraft(row.draft);
    setPostedRow(row.key);
    setTimeout(() => {
      setPostedRow((cur) => (cur === row.key ? null : cur));
      setOpenRow((cur) => (cur === row.key ? null : cur));
    }, 2200);
  };

  return (
    <View>
      <View style={styles.weekStrip}>
        {days.map((d, i) => {
          const n = eventsOn(d.getTime()).length;
          const active = i === selected;
          return (
            <Pressable
              key={d.getTime()}
              style={[styles.dayCell, active && styles.dayCellOn]}
              onPress={() => {
                setSelected(i);
                setOpenRow(null);
              }}
            >
              <Text style={[styles.dayName, active && styles.dayTextOn]}>
                {d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)}
              </Text>
              <Text style={[styles.dayNum, active && styles.dayTextOn]}>{d.getDate()}</Text>
              <View style={styles.dotRow}>
                {[...Array(Math.min(n, 3))].map((_, k) => (
                  <View key={k} style={styles.dot} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      {rows.map((row) => {
        const open = openRow === row.key;
        const posted = postedRow === row.key;
        return (
          <View key={row.key} style={[styles.row, open && styles.rowOpen]}>
            <Pressable
              style={styles.rowHead}
              onPress={() => setOpenRow(open ? null : row.key)}
              hitSlop={4}
            >
              <Text style={[styles.time, row.kind === 'event' && styles.timeEvent]}>
                {row.timeLabel}
              </Text>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {row.kind === 'event' ? `📅 ${row.title}` : row.title}
              </Text>
              <Text style={styles.chev}>{open ? '▾' : '▸'}</Text>
            </Pressable>
            {open && (
              <View style={styles.rowBody}>
                <Text style={styles.draftQ}>{row.draft.question}</Text>
                {row.draft.options && row.draft.options.length > 0 && (
                  <Text style={styles.draftOpts} numberOfLines={2}>
                    {row.draft.options.join('  ·  ')}
                  </Text>
                )}
                {posted ? (
                  <Text style={styles.postedNote}>🕊️ Launched to your Tree — advisors incoming</Text>
                ) : (
                  <View style={styles.btnRow}>
                    <Pressable style={styles.postBtn} onPress={() => post(row)} hitSlop={6}>
                      <Text style={styles.postBtnText}>🕊️ Post SURV now</Text>
                    </Pressable>
                    <Pressable onPress={() => onDraft(row.draft)} hitSlop={8}>
                      <Text style={styles.editLink}>edit in composer →</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// Styled for the light Profile card surface.
const styles = StyleSheet.create({
  weekStrip: { flexDirection: 'row', gap: 5, marginBottom: 10 },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  dayCellOn: { backgroundColor: colors.owl, borderColor: colors.owl },
  dayName: { color: colors.inkFaint, fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase' },
  dayNum: { color: colors.ink, fontSize: 14.5, fontFamily: 'SpaceGrotesk_700Bold', marginTop: 1 },
  dayTextOn: { color: colors.white },
  dotRow: { flexDirection: 'row', gap: 2, height: 5, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.owlDeep },
  row: {
    borderRadius: 10,
    marginBottom: 5,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  rowOpen: { borderColor: colors.owl },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8 },
  time: { color: colors.inkFaint, fontSize: 10.5, fontWeight: '700', width: 62 },
  timeEvent: { color: colors.owlDeep },
  rowTitle: { color: colors.ink, fontSize: 12.5, fontWeight: '600', flex: 1 },
  chev: { color: colors.owlDeep, fontSize: 12 },
  rowBody: { paddingHorizontal: 10, paddingBottom: 10, gap: 6 },
  draftQ: { color: colors.ink, fontFamily: 'SpaceGrotesk_500Medium', fontSize: 13, lineHeight: 18 },
  draftOpts: { color: colors.inkSoft, fontSize: 11.5 },
  btnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  postBtn: { backgroundColor: colors.owl, borderRadius: radius.chip, paddingHorizontal: 12, paddingVertical: 6 },
  postBtnText: { color: colors.white, fontWeight: '800', fontSize: 11.5 },
  editLink: { color: colors.owlDeep, fontSize: 11.5, fontWeight: '600' },
  postedNote: { color: colors.owlDeep, fontWeight: '800', fontSize: 12 },
});
