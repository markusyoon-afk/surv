// The public arena on the Tree: top SURVs from everywhere, live tallies,
// merit badges, and one-tap votes that train YOUR sage when they land well.

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { activeArenaSurvs, arenaStats, type ArenaSurv } from '../engine/arena';
import { formatRemaining } from '../engine/sage';
import { useSurv } from '../engine/store';
import { CATEGORY_ICONS, colors, radius } from '../theme';

export function ArenaFeed() {
  const { arenaVotes, voteArena } = useSurv();
  const [refreshKey, setRefreshKey] = useState(0);
  const now = Date.now();
  const survs = useMemo(() => activeArenaSurvs(now), [Math.floor(now / 30_000), refreshKey]);
  const stats = arenaStats(now);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 90 }}>
      <View style={styles.ticker}>
        <Ionicons name="pulse" size={14} color={colors.sage} />
        <Text style={styles.tickerText}>
          {stats.liveNow.toLocaleString()} SURVs live now · {stats.votesLastHour.toLocaleString()} votes this hour
        </Text>
        <Pressable onPress={() => setRefreshKey((k) => k + 1)} hitSlop={8}>
          <Ionicons name="refresh" size={14} color={colors.star} />
        </Pressable>
      </View>
      {survs.map((s) => (
        <ArenaCard key={s.id} surv={s} myVote={arenaVotes[s.id]} onVote={voteArena} />
      ))}
      <Text style={styles.hint}>
        Every vote here is advice to a real decision-maker. When they act and it goes
        well, your SAGE grows — this is the road to Super Sage.
      </Text>
    </ScrollView>
  );
}

function ArenaCard({
  surv,
  myVote,
  onVote,
}: {
  surv: ArenaSurv;
  myVote?: string;
  onVote: (survId: string, optionId: string) => void;
}) {
  const voted = !!myVote;
  const total = surv.votes + (voted ? 1 : 0);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={{ fontSize: 22 }}>{surv.askerAvatar}</Text>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.asker}>{surv.askerName}</Text>
            <View style={styles.aiChip}>
              <Text style={styles.aiChipText}>AI</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Ionicons
              name={CATEGORY_ICONS[surv.category] as keyof typeof Ionicons.glyphMap}
              size={11}
              color={colors.inkFaint}
            />
            <Text style={styles.meta}>
              {surv.category} · {total.toLocaleString()} votes · {formatRemaining(surv.expiresAt - Date.now())} left
            </Text>
          </View>
        </View>
      </View>

      {surv.badges.length > 0 && (
        <View style={styles.badgeRow}>
          {surv.badges.map((b) => (
            <View key={b} style={styles.badge}>
              <Text style={styles.badgeText}>{b}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.question}>{surv.question}</Text>

      {surv.options.map((opt, i) => {
        const isMine = myVote === opt.id;
        const share = Math.round(surv.split[i] * 1000) / 10;
        return voted ? (
          <View key={opt.id} style={styles.barRow}>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.max(share, 2)}%` }, isMine && styles.barMine]} />
              <Text style={styles.barLabel} numberOfLines={1}>
                {opt.label}
                {isMine ? '  · your call' : ''}
              </Text>
            </View>
            <Text style={styles.barPct}>{share.toFixed(1)}%</Text>
          </View>
        ) : (
          <Pressable key={opt.id} style={styles.voteBtn} onPress={() => onVote(surv.id, opt.id)}>
            <Text style={styles.voteText}>{opt.label}</Text>
          </Pressable>
        );
      })}
      {voted && <Text style={styles.votedNote}>Vote in — you’ll hear how it turned out 🦉</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  ticker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.nightCard,
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(78,201,180,0.25)',
  },
  tickerText: { color: colors.white, fontWeight: '600', fontSize: 12, flex: 1 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.card,
    padding: 14,
    marginHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  asker: { color: colors.ink, fontWeight: '700', fontSize: 14.5 },
  aiChip: { backgroundColor: colors.panelDeep, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  aiChipText: { color: colors.inkSoft, fontWeight: '800', fontSize: 9 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { color: colors.inkFaint, fontSize: 11.5, fontWeight: '500' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 7 },
  badge: { backgroundColor: '#fdf3d8', borderRadius: radius.chip, paddingHorizontal: 9, paddingVertical: 3 },
  badgeText: { color: '#8a6d1a', fontWeight: '700', fontSize: 11 },
  question: { color: colors.ink, fontSize: 15.5, fontWeight: '700', marginBottom: 9, lineHeight: 20 },
  voteBtn: {
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.chip,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  voteText: { color: colors.ink, fontWeight: '600', fontSize: 13.5 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  barTrack: { flex: 1, height: 28, backgroundColor: colors.panelDeep, borderRadius: 8, overflow: 'hidden', justifyContent: 'center' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.sageBar, borderRadius: 8 },
  barMine: { backgroundColor: colors.owl },
  barLabel: { color: colors.ink, fontSize: 12.5, fontWeight: '600', paddingHorizontal: 10 },
  barPct: { color: colors.owlDeep, fontWeight: '700', fontSize: 13, width: 50, textAlign: 'right' },
  votedNote: { color: colors.inkSoft, fontSize: 11.5, fontStyle: 'italic', marginTop: 3 },
  hint: { color: colors.star, fontSize: 12.5, paddingHorizontal: 22, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
});
