// The Sages dashboard: top SURVs (merit badges) and the Sage leaderboard —
// ranked by decisions helped toward good outcomes, not vanity metrics.

import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { OwlAvatar, stageForClout } from '../components/OwlAvatar';
import { activeArenaSurvs, type ArenaSurv } from '../engine/arena';
import { getPopulation, STAR_AVATARS } from '../engine/population';
import { formatRemaining } from '../engine/sage';
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

export function Sages({ onOpen }: { onOpen: (surv: Surv) => void }) {
  const { me, users, nests, survs, arenaVotes, voteArena, addSageToNest } = useSurv();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recruited, setRecruited] = useState<string | null>(null);
  const myNest = nests.find((n) => n.ownerId === me.id) ?? nests[0];
  // The board refreshes every minute: countdowns tick, closed SURVs drop out,
  // and the ranking re-sorts so it's always the live top 10.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

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

  const topArena: ArenaSurv[] = useMemo(() => activeArenaSurvs(now, 10), [now]);
  const myBest = useMemo(
    () =>
      [...survs]
        .filter((s) => s.status === 'live' && s.expiresAt > now)
        .sort((a, b) => b.votes.length - a.votes.length)
        .slice(0, 2),
    [survs, now],
  );

  const myRank = leaderboard.findIndex((r) => r.user.id === me.id);

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 100 }}>
      <View style={styles.card}>
        <Text style={styles.title}>🏆 Top 10 SURVs — live right now</Text>
        <Text style={styles.sub}>
          Refreshes every minute. Tap any row to vote before it closes.
        </Text>
        {topArena.map((s, i) => {
          const myVote = arenaVotes[s.id];
          const open = expandedId === s.id;
          return (
            <Pressable
              key={s.id}
              style={styles.survRow}
              onPress={() => setExpandedId(open ? null : s.id)}
            >
              <Text style={styles.rank}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.survQ} numberOfLines={2}>{s.question}</Text>
                <Text style={styles.survMeta}>
                  {s.askerName} · {(s.votes + (myVote ? 1 : 0)).toLocaleString()} votes ·{' '}
                  <Text style={styles.countdown}>⏳ {formatRemaining(s.expiresAt - now)} left</Text>
                  {s.badges.length > 0 ? `  ${s.badges.join(' ')}` : ''}
                </Text>
                {open && !myVote && (
                  <View style={styles.voteRow}>
                    {s.options.map((opt) => (
                      <Pressable
                        key={opt.id}
                        style={styles.voteChip}
                        onPress={() => voteArena(s.id, opt.id)}
                      >
                        <Text style={styles.voteChipText}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
                {open && myVote && (
                  <Text style={styles.votedText}>
                    ✓ Your call: {s.options.find((o) => o.id === myVote)?.label} — you’ll hear how it lands
                  </Text>
                )}
              </View>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.inkFaint} />
            </Pressable>
          );
        })}
      </View>

      {myBest.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.title}>🌳 Live from your Tree</Text>
          {myBest.map((s) => (
            <Pressable key={s.id} style={styles.survRow} onPress={() => onOpen(s)}>
              <Ionicons name="leaf" size={14} color={colors.owlDeep} style={{ marginTop: 3 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.survQ} numberOfLines={2}>{s.question}</Text>
                <Text style={styles.survMeta}>
                  {s.votes.length} vote{s.votes.length === 1 ? '' : 's'} ·{' '}
                  <Text style={styles.countdown}>⏳ {formatRemaining(s.expiresAt - now)} left</Text>
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.inkFaint} />
            </Pressable>
          ))}
        </View>
      )}

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
              {row.user.isAI && myNest && !nests.some((n) => n.members.some((m) => m.userId === row.user.id)) && (
                <Pressable
                  style={styles.recruitBtn}
                  onPress={() => {
                    addSageToNest(row.user, myNest.id);
                    setRecruited(`${row.user.name.split(' ')[0]} joined ${myNest.emoji} ${myNest.name} — they’ll weigh in on your Tree SURVs`);
                  }}
                >
                  <Ionicons name="person-add" size={12} color={colors.white} />
                </Pressable>
              )}
            </View>
          );
        })}
        {recruited && <Text style={styles.recruitNote}>✓ {recruited}</Text>}
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
  title: { color: colors.ink, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, marginBottom: 4 },
  sub: { color: colors.inkSoft, fontSize: 12, marginBottom: 8 },
  survRow: { flexDirection: 'row', gap: 10, paddingVertical: 7, alignItems: 'flex-start' },
  rank: { color: colors.inkFaint, fontWeight: '800', fontSize: 13, width: 18, textAlign: 'center', marginTop: 2 },
  survQ: { color: colors.ink, fontWeight: '600', fontSize: 13.5 },
  survMeta: { color: colors.inkFaint, fontSize: 11.5, marginTop: 2 },
  countdown: { color: colors.owlDeep, fontWeight: '700' },
  voteRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 },
  voteChip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.chip,
    borderRadius: radius.chip,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  voteChipText: { color: colors.ink, fontWeight: '600', fontSize: 12 },
  votedText: { color: colors.owlDeep, fontWeight: '600', fontSize: 12, marginTop: 6 },
  sageRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6, borderRadius: 10, paddingHorizontal: 4 },
  sageRowMe: { backgroundColor: 'rgba(78,201,180,0.12)' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sageName: { color: colors.ink, fontWeight: '700', fontSize: 13.5 },
  aiChip: { backgroundColor: colors.panelDeep, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  aiChipText: { color: colors.inkSoft, fontWeight: '800', fontSize: 9 },
  sageMeta: { color: colors.inkSoft, fontSize: 11.5, marginTop: 1 },
  clout: { color: colors.owlDeep, fontWeight: '800', fontSize: 13 },
  recruitBtn: { backgroundColor: colors.owl, borderRadius: 12, padding: 6, marginLeft: 4 },
  recruitNote: { color: colors.good, fontWeight: '600', fontSize: 12, marginTop: 8 },
  meFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  meFooterText: { color: colors.inkSoft, fontSize: 12, flex: 1, fontStyle: 'italic' },
});
