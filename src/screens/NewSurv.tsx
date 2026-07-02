// +SURV — post a decision. Question → AI-suggested options → duration → audience → SURVit!

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { suggestOptions } from '../engine/suggest';
import { useSurv } from '../engine/store';
import { CATEGORIES, type Category, type SurvOption } from '../engine/types';
import { colors, radius } from '../theme';

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

export function NewSurv({ onPosted }: { onPosted: () => void }) {
  const { me, nests, createSurv } = useSurv();
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState<Category>('Living');
  const [options, setOptions] = useState<SurvOption[]>([]);
  const [manual, setManual] = useState('');
  const [duration, setDuration] = useState<number>(24 * HOUR);
  const [isPublic, setIsPublic] = useState(false);
  const [nestIds, setNestIds] = useState<string[]>([nests[0]?.id].filter(Boolean));
  const [busy, setBusy] = useState(false);

  const myNests = nests.filter(
    (n) => n.ownerId === me.id || n.members.some((m) => m.userId === me.id),
  );

  const suggest = async () => {
    setBusy(true);
    try {
      const result = await suggestOptions(question, me);
      setCategory(result.category);
      setOptions((prev) => {
        const kept = prev.filter((o) => o.source === 'user');
        return [...kept, ...result.options].slice(0, 4);
      });
    } finally {
      setBusy(false);
    }
  };

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

        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={c} on={category === c} onPress={() => setCategory(c)} />
          ))}
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
            <View style={{ flex: 1 }}>
              <Text style={styles.optionText}>{opt.label}</Text>
              {opt.why ? <Text style={styles.optionWhy}>{sourceIcon(opt.source)} {opt.why}</Text> : null}
            </View>
            <Pressable onPress={() => setOptions((prev) => prev.filter((o) => o.id !== opt.id))}>
              <Text style={styles.remove}>✕</Text>
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
  chipText: { color: colors.inkSoft, fontSize: 12.5, fontWeight: '600' },
  chipTextOn: { color: colors.white },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
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
  remove: { color: colors.danger, fontWeight: '800', paddingHorizontal: 8, fontSize: 16 },
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
