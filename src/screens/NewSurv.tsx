// +SURV — post a decision. Question → AI-suggested options → duration → audience → SURVit!

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DraftCards } from '../components/DraftCards';
import { categoryQuestion, type SurvDraft } from '../engine/drafts';
import { suggestOptions, type SuggestContext } from '../engine/suggest';
import { useSurv } from '../engine/store';
import { TRENDING_SURVS, type TrendingSurv } from '../engine/trending';
import { CATEGORIES, type Category, type SurvOption } from '../engine/types';
import { CATEGORY_ICONS, colors, radius } from '../theme';

const HOUR = 3600_000;
// Durations the alpha testers voted for in SURV #108 (2011): 1h / 6h / 24h / 3d / 1w
const DURATIONS: Array<[string, number]> = [
  ['1 hr', HOUR],
  ['6 hrs', 6 * HOUR],
  ['24 hrs', 24 * HOUR],
  ['3 days', 72 * HOUR],
  ['1 week', 168 * HOUR],
];

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
  const { me, users, nests, survs, geo, nearbyPlaces, requestLocation, createSurv } = useSurv();
  const [locating, setLocating] = useState(false);
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState<Category>('Living');
  const [options, setOptions] = useState<SurvOption[]>([]);
  const [manual, setManual] = useState('');
  const [duration, setDuration] = useState<number>(24 * HOUR);
  const [isPublic, setIsPublic] = useState(false);
  const [nestIds, setNestIds] = useState<string[]>([nests[0]?.id].filter(Boolean));
  const [busy, setBusy] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

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

  const suggest = () => suggestFor(question, category);

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

  /** One tap: prefill the routine decision and load its top-3 options. */
  const applyDraft = (draft: SurvDraft) => {
    setQuestion(draft.question);
    setCategory(draft.category);
    const preset = DURATIONS.find(([, ms]) => ms >= draft.durationMs);
    setDuration(preset ? preset[1] : DURATIONS[0][1]);
    setOptions([]);
    suggestFor(draft.question);
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
    onPosted();
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      {question.trim() === '' && options.length === 0 && (
        <>
          <DraftCards onSelect={applyDraft} />
          <View style={styles.trendingWrap}>
            <Text style={styles.trendingTitle}>TOP SURVS OUT THERE — TAP TO REUSE</Text>
            {TRENDING_SURVS.map((t) => (
              <Pressable key={t.id} style={styles.trendingCard} onPress={() => applyTrending(t)}>
                <Ionicons
                  name={CATEGORY_ICONS[t.category] as keyof typeof Ionicons.glyphMap}
                  size={15}
                  color={colors.sage}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.trendingQ}>{t.question}</Text>
                  <Text style={styles.trendingMeta}>
                    {t.category} · reused {t.reuses}× · options included
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={colors.star} />
              </Pressable>
            ))}
          </View>
        </>
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
          <Text style={styles.label}>Category — tap one to auto-draft</Text>
          <Pressable style={styles.geoChip} onPress={locate} disabled={locating}>
            <Text style={styles.geoChipText}>
              {locating ? '📍 Locating…' : geo ? `📍 ${geo.city ?? 'Located'}` : '📍 Use my location'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => {
            const on = category === c;
            return (
              <Pressable key={c} style={[styles.catChip, on && styles.catChipOn]} onPress={() => tapCategory(c)}>
                <Ionicons
                  name={CATEGORY_ICONS[c] as keyof typeof Ionicons.glyphMap}
                  size={14}
                  color={on ? colors.white : colors.inkSoft}
                />
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
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

        <Text style={styles.label}>Countdown</Text>
        <View style={styles.chips}>
          {DURATIONS.map(([label, ms]) => (
            <Chip key={label} label={label} on={duration === ms} onPress={() => setDuration(ms)} />
          ))}
        </View>

        <Text style={styles.label}>Who decides with you</Text>
        <View style={styles.chips}>
          <Chip label="🌍 Public" on={isPublic} onPress={() => setIsPublic(!isPublic)} />
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
    minHeight: 64,
    fontSize: 16,
    color: colors.ink,
    fontWeight: '600',
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.chip,
    padding: 10,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', color: colors.inkFaint, fontSize: 11, marginTop: 2 },
  label: { color: colors.inkSoft, fontWeight: '800', fontSize: 12.5, marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: radius.chip, backgroundColor: colors.panelDeep },
  chipOn: { backgroundColor: colors.owl },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radius.chip,
    backgroundColor: colors.panelDeep,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  catChipOn: { backgroundColor: colors.owl, borderColor: colors.owl },
  chipText: { color: colors.inkSoft, fontSize: 12.5, fontWeight: '600' },
  chipTextOn: { color: colors.white },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  geoChip: { backgroundColor: colors.panelDeep, borderRadius: radius.chip, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10 },
  geoChipText: { color: colors.owlDeep, fontWeight: '700', fontSize: 11.5 },
  trendingWrap: { marginBottom: 12 },
  trendingTitle: { color: colors.sage, fontWeight: '700', fontSize: 10.5, letterSpacing: 1, marginBottom: 7, paddingHorizontal: 2 },
  trendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.nightCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(78,201,180,0.22)',
    padding: 11,
    marginBottom: 7,
  },
  trendingQ: { color: colors.white, fontWeight: '600', fontSize: 13.5 },
  trendingMeta: { color: colors.star, fontSize: 11, marginTop: 2 },
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
    backgroundColor: colors.owl,
    borderRadius: radius.card,
    paddingVertical: 13,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  survitOff: { opacity: 0.45 },
  survitText: { color: colors.white, fontWeight: '900', fontSize: 17, letterSpacing: 0.5 },
});
