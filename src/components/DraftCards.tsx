// One-tap SURV drafts for right now — schedule- and habit-aware.
// ⚡ Post now sends it straight to your Tree: options auto-filled, zero composer.

import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildDrafts, type SurvDraft } from '../engine/drafts';
import { suggestOptionsHeuristic } from '../engine/suggest';
import { useSurv } from '../engine/store';
import { colors, radius } from '../theme';

export function DraftCards({
  horizontal = false,
  onSelect,
}: {
  horizontal?: boolean;
  onSelect: (draft: SurvDraft) => void;
}) {
  const { me, users, nests, survs, calendarEvents, healthConnected, geo, nearbyPlaces, createSurv } = useSurv();
  const drafts = useMemo(
    () =>
      buildDrafts(
        survs.filter((s) => s.askerId === me.id),
        me,
        new Date(),
        4,
        calendarEvents,
        healthConnected,
      ),
    [survs, me, calendarEvents, healthConnected],
  );
  if (drafts.length === 0) return null;

  /** Zero-composer posting: options auto-filled, flight set, off to your Tree. */
  const quickPost = (d: SurvDraft) => {
    const options = d.options?.length
      ? d.options.map((label, i) => ({
          id: `opt_q_${Date.now()}_${i}`,
          label,
          source: 'ai' as const,
          why: d.reason,
        }))
      : suggestOptionsHeuristic(d.question, me, 3, {
          users,
          nests,
          city: geo?.city,
          placesByCategory: nearbyPlaces,
          categoryHint: d.category,
        }).options;
    const myNestIds = nests
      .filter((n) => n.ownerId === me.id || n.members.some((m) => m.userId === me.id))
      .map((n) => n.id);
    createSurv({
      question: d.question,
      category: d.category,
      options,
      audience: myNestIds.length > 0 ? { kind: 'nests', nestIds: myNestIds } : { kind: 'public' },
      durationMs: Math.min(d.durationMs, 24 * 3600_000),
    });
  };

  const cards = drafts.map((d) => (
    <Pressable
      key={d.id}
      style={[styles.card, horizontal && styles.cardHorizontal]}
      onPress={() => onSelect(d)}
    >
      <Text style={styles.reason}>⚡ {d.reason}</Text>
      <Text style={styles.question} numberOfLines={2}>
        {d.question}
      </Text>
      <View style={styles.actions}>
        <Pressable style={styles.postBtn} onPress={() => quickPost(d)} hitSlop={6}>
          <Text style={styles.postBtnText}>🕊️ Post now</Text>
        </Pressable>
        <Text style={styles.cta}>edit →</Text>
      </View>
    </Pressable>
  ));

  if (horizontal) {
    return (
      <View style={styles.stripWrap}>
        <Text style={styles.stripTitle}>QUICK SURVS FOR RIGHT NOW</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {cards}
        </ScrollView>
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={styles.listTitle}>Quick SURVs for right now</Text>
      {cards}
    </View>
  );
}

const styles = StyleSheet.create({
  stripWrap: { marginBottom: 10 },
  stripTitle: {
    color: colors.sage,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  strip: { paddingHorizontal: 14, gap: 8 },
  listTitle: { color: colors.inkSoft, fontWeight: '800', fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card: {
    backgroundColor: colors.nightCard,
    borderRadius: radius.card,
    padding: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(87,193,178,0.35)',
  },
  cardHorizontal: { width: 210, marginBottom: 0 },
  reason: { color: colors.sage, fontWeight: '800', fontSize: 11.5 },
  question: { color: colors.white, fontWeight: '700', fontSize: 13.5, marginTop: 3, lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
  postBtn: { backgroundColor: colors.sage, borderRadius: radius.chip, paddingHorizontal: 10, paddingVertical: 4 },
  postBtnText: { color: colors.navy, fontWeight: '800', fontSize: 11 },
  cta: { color: colors.star, fontSize: 11, fontWeight: '600' },
});
