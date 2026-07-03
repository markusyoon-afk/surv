// +SURV — post a decision. Question → AI-suggested options → duration → audience → SURVit!

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { buildDrafts, categoryQuestion, type SurvDraft } from '../engine/drafts';
import { suggestOptions, type SuggestContext } from '../engine/suggest';
import { useSurv } from '../engine/store';
import { TRENDING_SURVS, type TrendingSurv } from '../engine/trending';
import { CATEGORIES, type Category, type SurvOption } from '../engine/types';
import { CATEGORY_ICONS, CATEGORY_LABELS, colors, radius } from '../theme';

const HOUR = 3600_000;
// Daily decisions, not deep thought: 8 hrs is the ceiling.
// Optimal defaults: Forest 1 hr (always-on crowd), Tree 3 hrs (one phone-check cycle).
const DURATIONS: Array<[string, number]> = [
  ['⚡ ASAP', 5 * 60_000],
  ['30 min', 30 * 60_000],
  ['1 hr', HOUR],
  ['3 hrs', 3 * HOUR],
  ['8 hrs', 8 * HOUR],
];
const FOREST_DEFAULT = HOUR;
const TREE_DEFAULT = 3 * HOUR;
const MAX_FLIGHT = 8 * HOUR;

const MAX_Q = 140;

export function NewSurv({
  onPosted,
  initialDraft,
  onDraftConsumed,
}: {
  onPosted: () => void;
  initialDraft?: SurvDraft | null;
  onDraftConsumed?: () => void;
}) {
  const { me, users, nests, survs, geo, nearbyPlaces, requestLocation, createSurv, calendarEvents, healthConnected } = useSurv();
  const [locating, setLocating] = useState(false);
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState<Category>('Living');
  const [options, setOptions] = useState<SurvOption[]>([]);
  const [manual, setManual] = useState('');
  const [duration, setDuration] = useState<number>(TREE_DEFAULT);
  const [isPublic, setIsPublic] = useState(false);
  const [nestIds, setNestIds] = useState<string[]>([nests[0]?.id].filter(Boolean));
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);
  // Only lock the category into suggestions when the user actually chose it.
  const [categoryPicked, setCategoryPicked] = useState(false);

  const myNests = nests.filter(
    (n) => n.ownerId === me.id || n.members.some((m) => m.userId === me.id),
  );

  const suggestCtx = (): SuggestContext => ({
    users,
    nests,
    city: geo?.city,
    placesByCategory: nearbyPlaces,
  });

  const suggestFor = async (q: string, lockCategory?: Category, exclude: string[] = rejected) => {
    setBusy(true);
    try {
      const result = await suggestOptions(q, me, 3, {
        ...suggestCtx(),
        categoryHint: lockCategory,
        excludeLabels: exclude,
      });
      setCategory(lockCategory ?? result.category);
      setOptions((prev) => {
        const kept = prev.filter((o) => o.source === 'user');
        return [...kept, ...result.options].slice(0, 4);
      });
    } finally {
      setBusy(false);
    }
  };

  const suggest = () => suggestFor(question, categoryPicked ? category : undefined);

  /** X on a suggestion rejects it — and a fresh idea takes its place. */
  const rejectOption = async (opt: SurvOption) => {
    const nextRejected = [...rejected, opt.label];
    setRejected(nextRejected);
    const remaining = options.filter((o) => o.id !== opt.id);
    setOptions(remaining);
    if (opt.source === 'user' || question.trim().length < 8) return;
    const result = await suggestOptions(question, me, 1, {
      ...suggestCtx(),
      categoryHint: category,
      excludeLabels: [...nextRejected, ...remaining.map((o) => o.label)],
    });
    if (result.options.length > 0) {
      setOptions((prev) => (prev.length < 4 ? [...prev, result.options[0]] : prev));
    }
  };

  /** Tap a suggestion to edit it yourself — it moves into the manual field. */
  const editOption = (opt: SurvOption) => {
    setOptions((prev) => prev.filter((o) => o.id !== opt.id));
    setManual(opt.label);
  };

  /** One-tap adoption of a proven SURV. */
  const applyTrending = (t: TrendingSurv) => {
    setQuestion(t.question);
    setCategory(t.category);
    setOptions(
      t.options.map((label, i) => ({
        id: `opt_tr_${Date.now()}_${i}`,
        label,
        source: 'nest',
        why: 'Trending on SURV',
      })),
    );
    const preset = DURATIONS.find(([, ms]) => ms >= t.durationMs);
    setDuration(preset ? preset[1] : DURATIONS[2][1]);
    setRejected([]);
  };

  /** Tap a category with an empty question → SURV drafted from habits + schedule + location. */
  const tapCategory = (c: Category) => {
    setCategory(c);
    setCategoryPicked(true);
    if (question.trim() === '') {
      const mySurvs = survs.filter((s) => s.askerId === me.id);
      const q = categoryQuestion(c, mySurvs, new Date(), geo?.city);
      setQuestion(q);
      suggestFor(q, c);
    }
  };

  const locate = async () => {
    setLocating(true);
    try {
      await requestLocation();
    } finally {
      setLocating(false);
    }
  };

  /** One tap: prefill the routine decision and load its options. */
  const applyDraft = (draft: SurvDraft) => {
    setQuestion(draft.question);
    setCategory(draft.category);
    setDuration(Math.min(Math.max(draft.durationMs, 5 * 60_000), MAX_FLIGHT));
    if (draft.options && draft.options.length > 0) {
      // Event-specific decisions come with their options pre-baked.
      setOptions(
        draft.options.map((label, i) => ({
          id: `opt_ev_${Date.now()}_${i}`,
          label,
          source: 'ai',
          why: draft.reason,
        })),
      );
    } else {
      setOptions([]);
      suggestFor(draft.question, draft.category);
    }
  };

  useEffect(() => {
    if (initialDraft) {
      applyDraft(initialDraft);
      onDraftConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraft]);

  const addManual = () => {
    const label = manual.trim();
    if (!label || options.length >= 4) return;
    setOptions((prev) => [...prev, { id: `opt_u_${Date.now()}`, label, source: 'user' }]);
    setManual('');
  };

  const canPost = question.trim().length >= 8 && options.length >= 2 && (isPublic || nestIds.length > 0);

  const post = () => {
    if (!canPost) return;
    createSurv({
      question: question.trim(),
      category,
      options,
      audience: isPublic ? { kind: 'public' } : { kind: 'nests', nestIds },
      durationMs: duration,
    });
    setQuestion('');
    setOptions([]);
    setCategoryPicked(false);
    setRejected([]);
    onPosted();
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      {question.trim() === '' && options.length === 0 && (
        <View style={styles.ideasWrap}>
          <View style={styles.ideasHeader}>
            <Text style={styles.ideasTitle}>IDEAS — ONE TAP AND IT’S DRAFTED</Text>
            <View style={styles.ideasSwipe}>
              <Text style={styles.ideasSwipeText}>swipe</Text>
              <Ionicons name="arrow-forward" size={11} color={colors.sage} />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.ideasStrip}>
            {buildDrafts(survs.filter((s) => s.askerId === me.id), me, new Date(), 4, calendarEvents, healthConnected).map((d) => (
              <Pressable key={d.id} style={styles.ideaCard} onPress={() => applyDraft(d)}>
                <Text style={styles.ideaReason}>⚡ {d.reason}</Text>
                <Text style={styles.ideaQ} numberOfLines={3}>{d.question}</Text>
              </Pressable>
            ))}
            {TRENDING_SURVS.map((t) => (
              <Pressable key={t.id} style={styles.ideaCard} onPress={() => applyTrending(t)}>
                <Text style={styles.ideaReason}>🔥 Trending · {t.reuses}×</Text>
                <Text style={styles.ideaQ} numberOfLines={3}>{t.question}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      <View style={styles.card}>
        <TextInput
          style={styles.question}
          placeholder="What to do?! (max 140 characters)"
          placeholderTextColor={colors.inkFaint}
          value={question}
          onChangeText={(t) => setQuestion(t.slice(0, MAX_Q))}
          multiline
        />
        <Text style={styles.counter}>{MAX_Q - question.length}</Text>

        <View style={styles.rowBetween}>
          <Text style={styles.label}>Pick a category</Text>
          <Pressable style={styles.geoChip} onPress={locate} disabled={locating}>
            <Text style={styles.geoChipText}>
              {locating ? '📍 Locating…' : geo ? `📍 ${geo.city ?? 'Located'}` : '📍 Use my location'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.catGrid}>
          {CATEGORIES.map((c) => {
            const on = category === c;
            return (
              <Pressable key={c} style={[styles.catTile, on && styles.catTileOn]} onPress={() => tapCategory(c)}>
                <Ionicons
                  name={CATEGORY_ICONS[c] as keyof typeof Ionicons.glyphMap}
                  size={22}
                  color={on ? colors.white : colors.owlDeep}
                />
                <Text style={[styles.catTileText, on && styles.catTileTextOn]}>{CATEGORY_LABELS[c]}</Text>
              </Pressable>
            );
          })}
        </View>


        <View style={styles.rowBetween}>
          <Text style={styles.label}>Options ({options.length}/4)</Text>
          <Pressable style={styles.suggestBtn} onPress={suggest} disabled={busy || question.trim().length < 8}>
            {busy ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.suggestText}>✨ Suggest options</Text>
            )}
          </Pressable>
        </View>
        {options.map((opt) => (
          <View key={opt.id} style={styles.option}>
            <Pressable style={{ flex: 1 }} onPress={() => editOption(opt)}>
              <Text style={styles.optionText}>{opt.label}</Text>
              <Text style={styles.optionWhy}>
                {opt.why ? `${sourceIcon(opt.source)} ${opt.why} · ` : ''}tap to edit
              </Text>
            </Pressable>
            <Pressable onPress={() => rejectOption(opt)} hitSlop={8}>
              <Ionicons name="refresh-circle" size={22} color={colors.inkFaint} />
            </Pressable>
          </View>
        ))}
        {options.length < 4 && (
          <View style={styles.manualRow}>
            <TextInput
              style={styles.manualInput}
              placeholder="Add your own option…"
              placeholderTextColor={colors.inkFaint}
              value={manual}
              onChangeText={setManual}
              onSubmitEditing={addManual}
            />
            <Pressable style={styles.addBtn} onPress={addManual}>
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.label}>Flight — {durationLabel(duration)}</Text>
        <DurationSlider valueMs={duration} onChange={setDuration} />
        <View style={styles.chips}>
          {DURATIONS.map(([label, ms]) => (
            <Chip key={label} label={label} on={duration === ms} onPress={() => setDuration(ms)} />
          ))}
        </View>

        <Text style={styles.label}>Your Nest, Tree, or Forest</Text>
        <View style={styles.chips}>
          <Chip
            label="🌲 The Forest"
            on={isPublic}
            onPress={() => {
              const next = !isPublic;
              setIsPublic(next);
              setDuration(next ? FOREST_DEFAULT : TREE_DEFAULT); // optimal per audience
            }}
          />
          {!isPublic && (
            <Chip
              label="🌳 My Tree"
              on={nestIds.length === myNests.length && myNests.length > 0}
              onPress={() => {
                setNestIds(myNests.map((n) => n.id));
                setDuration(TREE_DEFAULT);
              }}
            />
          )}
          {!isPublic &&
            myNests.map((n) => (
              <Chip
                key={n.id}
                label={`${n.emoji} ${n.name}`}
                on={nestIds.includes(n.id)}
                onPress={() =>
                  setNestIds((prev) =>
                    prev.includes(n.id) ? prev.filter((id) => id !== n.id) : [...prev, n.id],
                  )
                }
              />
            ))}
        </View>

        <Pressable style={[styles.survit, !canPost && styles.survitOff]} onPress={post}>
          <Text style={styles.survitText}>SURVit!</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function sourceIcon(source: SurvOption['source']): string {
  switch (source) {
    case 'yelp': return '🔴';
    case 'google_reviews': return '🟢';
    case 'nest': return '🪺';
    case 'history': return '🕘';
    case 'ai': return '✨';
    case 'places': return '📍';
    default: return '';
  }
}

const SLIDER_MIN = 5 * 60_000; // ⚡ ASAP
const SLIDER_MAX = 8 * HOUR;

function durationLabel(ms: number): string {
  if (ms <= 6 * 60_000) return '⚡ ASAP (5 min)';
  if (ms < HOUR) return `${Math.round(ms / 60_000)} min`;
  if (ms <= 24 * HOUR) {
    const hrs = Math.floor(ms / HOUR);
    const mins = Math.round((ms % HOUR) / 60_000);
    return mins > 0 ? `${hrs} hrs ${mins} min` : `${hrs} hr${hrs === 1 ? '' : 's'}`;
  }
  return `${Math.round(ms / (24 * HOUR))} days`;
}

/** Drag anywhere from immediate-ASAP to 24 hrs. Presets cover longer runs. */
function DurationSlider({ valueMs, onChange }: { valueMs: number; onChange: (ms: number) => void }) {
  const widthRef = useRef(1);
  const pct = Math.min(1, Math.max(0, (valueMs - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)));

  const update = (x: number) => {
    const p = Math.min(1, Math.max(0, x / widthRef.current));
    let ms = SLIDER_MIN + p * (SLIDER_MAX - SLIDER_MIN);
    // snap: 5-min steps under an hour, 30-min steps beyond
    const step = ms < HOUR ? 5 * 60_000 : 30 * 60_000;
    ms = Math.round(ms / step) * step;
    onChange(Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, ms)));
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => update(e.nativeEvent.locationX),
      onPanResponderMove: (e) => update(e.nativeEvent.locationX),
    }),
  ).current;

  return (
    <View
      style={styles.sliderTrackWrap}
      onLayout={(e) => {
        widthRef.current = Math.max(1, e.nativeEvent.layout.width);
      }}
      {...responder.panHandlers}
    >
      <View style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { width: `${pct * 100}%` }]} />
      </View>
      <View style={[styles.sliderThumb, { left: `${pct * 100}%` }]} />
      <View style={styles.sliderEnds}>
        <Text style={styles.sliderEndText}>⚡ ASAP</Text>
        <Text style={styles.sliderEndText}>8 hrs</Text>
      </View>
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 14, paddingBottom: 100 },
  card: { backgroundColor: colors.panel, borderRadius: radius.card, padding: 14 },
  question: {
    minHeight: 84,
    fontSize: 17.5,
    color: colors.ink,
    fontWeight: '700',
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.sage,
    padding: 13,
    textAlignVertical: 'top',
    shadowColor: colors.owl,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  counter: { alignSelf: 'flex-end', color: colors.inkFaint, fontSize: 11, marginTop: 2 },
  label: { color: colors.inkSoft, fontWeight: '800', fontSize: 12.5, marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.chip, backgroundColor: colors.panelDeep },
  chipOn: { backgroundColor: colors.owl },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catTile: {
    width: '17.5%',
    minWidth: 62,
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: colors.panelDeep,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  catTileOn: { backgroundColor: colors.owl, borderColor: colors.owl },
  catTileText: { color: colors.ink, fontSize: 11.5, fontWeight: '700' },
  catTileTextOn: { color: colors.white },
  chipText: { color: colors.inkSoft, fontSize: 12.5, fontWeight: '600' },
  chipTextOn: { color: colors.white },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  geoChip: { backgroundColor: colors.panelDeep, borderRadius: radius.chip, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10 },
  geoChipText: { color: colors.owlDeep, fontWeight: '700', fontSize: 11.5 },
  ideasWrap: { marginBottom: 12 },
  ideasHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7, paddingHorizontal: 2 },
  ideasTitle: { color: colors.sage, fontWeight: '700', fontSize: 10.5, letterSpacing: 1 },
  ideasSwipe: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ideasSwipeText: { color: colors.sage, fontSize: 10, fontWeight: '600' },
  ideasStrip: { gap: 8, paddingRight: 8, paddingBottom: 6 },
  ideaCard: {
    width: 150,
    backgroundColor: colors.nightCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(78,201,180,0.22)',
    padding: 11,
  },
  ideaReason: { color: colors.sage, fontWeight: '700', fontSize: 11 },
  ideaQ: { color: colors.white, fontWeight: '600', fontSize: 13, marginTop: 4, lineHeight: 17 },
  sliderTrackWrap: { paddingVertical: 10, marginBottom: 6, justifyContent: 'center' },
  sliderTrack: { height: 6, borderRadius: 3, backgroundColor: colors.panelDeep, overflow: 'hidden' },
  sliderFill: { height: '100%', backgroundColor: colors.sage, borderRadius: 3 },
  sliderThumb: {
    position: 'absolute',
    top: 1,
    marginLeft: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.owl,
    borderWidth: 3,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  sliderEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  sliderEndText: { color: colors.inkFaint, fontSize: 10.5, fontWeight: '600' },
  suggestBtn: { backgroundColor: colors.owlDeep, borderRadius: radius.chip, paddingHorizontal: 12, paddingVertical: 6, marginTop: 10 },
  suggestText: { color: colors.white, fontWeight: '700', fontSize: 12.5 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.chip,
    padding: 10,
    marginBottom: 6,
  },
  optionText: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  optionWhy: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },
  manualRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  manualInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.chip,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.ink,
  },
  addBtn: { backgroundColor: colors.panelDeep, borderRadius: radius.button, paddingHorizontal: 14, justifyContent: 'center' },
  addBtnText: { color: colors.inkSoft, fontWeight: '800' },
  survit: {
    marginTop: 18,
    alignSelf: 'center',
    backgroundColor: colors.owl,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 52,
    alignItems: 'center',
    shadowColor: colors.owlDeep,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 2,
    borderColor: colors.sage,
  },
  survitOff: { opacity: 0.45 },
  survitText: { color: colors.white, fontWeight: '900', fontSize: 18, letterSpacing: 1 },
});
