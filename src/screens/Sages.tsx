// The Sages dashboard: top SURVs (merit badges) and the Sage leaderboard —
// ranked by decisions helped toward good outcomes, not vanity metrics.

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { OwlAvatar, stageForClout } from '../components/OwlAvatar';
import { activeArenaSurvs } from '../engine/arena';
import { getPopulation, STAR_AVATARS } from '../engine/population';
import { useSurv } from '../engine/store';
import type { Surv, User } from '../engine/types';
import { colors, radius } from '../theme';

/** Good-outcome decisions this user's vote actually backed. */
function influenceScore(user: User, survs: Surv[]): number {
  return survs.filter(
    (s) =>
      s.status === 'graded' &&
      s.outcome === 'good' &&
      s.actedOptionId &&
      s.votes.some((v) => v.userId === user.id && v.optionId === s.actedOptionId),
  ).length;
}

/** Simulated lifetime influence for population avatars (deterministic). */
function avatarInfluence(user: User): number {
  const n = user.id.split('_').pop() ?? '0';
  const base = Math.round(user.clout * 4.2);
  return base + ((n.length * 37 + user.name.length * 13) % 120);
}

export function Sages() {
  const { me, users, survs } = useSurv();

  const leaderboard = useMemo(() => {
    const pool = [
      ...STAR_AVATARS,
      ...getPopulation().slice(STAR_AVATARS.length, STAR_AVATARS.length + 200),
    ];
    const rows = pool.map((u) => ({ user: u, influence: avatarInfluence(u) }));
    for (const u of users) {
      const real = influenceScore(u, survs);
      rows.push({ user: u, influence: u.isAI ? avatarInfluence(u) : real * 25 + Math.round(u.clout) });
    }
    return rows
      .sort((a, b) => b.influence - a.influence)
      .filter((r, i, arr) => arr.findIndex((x) => x.user.id === r.user.id) === i)
      .slice(0, 12);
  }, [users, survs]);

  const topSurvs = useMemo(() => {
    const arena = activeArenaSurvs(Date.now(), 5).map((s) => ({
      question: s.question,
      votes: s.votes,
      badges: s.badges,
      who: s.askerName,
    }));
    const myBest = [...survs]
      .sort((a, b) => b.votes.length - a.votes.length)
      .slice(0, 2)
      .map((s) => ({
        question: s.question,
        votes: s.votes.length,
        badges: s.status === 'graded' && s.outcome === 'good' ? ['🧠 Wise Call'] : [],
        who: 'Your network',
      }));
    return [...arena.slice(0, 4), ...myBest];
  }, [survs]);

  const myRank = leaderboard.findIndex((r) => r.user.id === me.id);

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 100 }}>
      <View style={styles.card}>
        <Text style={styles.title}>🏆 Top SURVs right now</Text>
        {topSurvs.map((s, i) => (
          <View key={i} style={styles.survRow}>
            <Text style={styles.rank}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.survQ} numberOfLines={2}>{s.question}</Text>
              <Text style={styles.survMeta}>
                {s.who} · {s.votes.toLocaleString()} votes {s.badges.join(' ')}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>🦉 The Sage leaderboard</Text>
        <Text style={styles.sub}>
          Ranked by decisions helped toward good outcomes — influence you earn, not buy.
        </Text>
        {leaderboard.map((row, i) => {
          const isMe = row.user.id === me.id;
          return (
            <View key={row.user.id} style={[styles.sageRow, isMe && styles.sageRowMe]}>
              <Text style={styles.rank}>{i + 1}</Text>
              {isMe ? (
                <OwlAvatar clout={me.clout} size={28} />
              ) : (
                <Text style={{ fontSize: 20 }}>{row.user.avatar}</Text>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.sageName}>{isMe ? `${row.user.name} (you)` : row.user.name}</Text>
                  {row.user.isAI && (
                    <View style={styles.aiChip}>
                      <Text style={styles.aiChipText}>AI</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.sageMeta}>
                  {stageForClout(row.user.clout).label} · {row.influence.toLocaleString()} good calls influenced
                </Text>
              </View>
              <Text style={styles.clout}>{Math.round(row.user.clout)}%</Text>
            </View>
          );
        })}
        {myRank === -1 && (
          <View style={styles.meFooter}>
            <Ionicons name="trending-up" size={13} color={colors.inkSoft} />
            <Text style={styles.meFooterText}>
              You’re climbing — every good call you back in the arena moves you up.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.card, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.hairline },
  title: { color: colors.ink, fontWeight: '700', fontSize: 15.5, marginBottom: 4 },
  sub: { color: colors.inkSoft, fontSize: 12, marginBottom: 8 },
  survRow: { flexDirection: 'row', gap: 10, paddingVertical: 7, alignItems: 'flex-start' },
  rank: { color: colors.inkFaint, fontWeight: '800', fontSize: 13, width: 18, textAlign: 'center', marginTop: 2 },
  survQ: { color: colors.ink, fontWeight: '600', fontSize: 13.5 },
  survMeta: { color: colors.inkFaint, fontSize: 11.5, marginTop: 2 },
  sageRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6, borderRadius: 10, paddingHorizontal: 4 },
  sageRowMe: { backgroundColor: 'rgba(78,201,180,0.12)' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sageName: { color: colors.ink, fontWeight: '700', fontSize: 13.5 },
  aiChip: { backgroundColor: colors.panelDeep, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  aiChipText: { color: colors.inkSoft, fontWeight: '800', fontSize: 9 },
  sageMeta: { color: colors.inkSoft, fontSize: 11.5, marginTop: 1 },
  clout: { color: colors.owlDeep, fontWeight: '800', fontSize: 13 },
  meFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  meFooterText: { color: colors.inkSoft, fontSize: 12, flex: 1, fontStyle: 'italic' },
});
