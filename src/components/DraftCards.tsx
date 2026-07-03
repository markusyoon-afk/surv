// One-tap SURV drafts for right now — schedule- and habit-aware.

import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildDrafts, type SurvDraft } from '../engine/drafts';
import { useSurv } from '../engine/store';
import { colors, radius } from '../theme';

export function DraftCards({
  horizontal = false,
  onSelect,
}: {
  horizontal?: boolean;
  onSelect: (draft: SurvDraft) => void;
}) {
  const { me, survs } = useSurv();
  const drafts = useMemo(
    () => buildDrafts(survs.filter((s) => s.askerId === me.id), me, new Date()),
    [survs, me],
  );
  if (drafts.length === 0) return null;

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
      <Text style={styles.cta}>Tap to draft →</Text>
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
  cta: { color: colors.star, fontSize: 11, marginTop: 5, fontWeight: '600' },
});
