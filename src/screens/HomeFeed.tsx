// The Tree — your sphere's decisions, one clean scroll. Flip to the Forest for
// every other tree out there. Filters are compact tap-to-cycle chips.

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Tap } from '../components/Tap';
import { ArenaFeed } from '../components/ArenaFeed';
import { DigestCard } from '../components/DigestCard';
import { SurvCard } from '../components/SurvCard';
import { msRemaining } from '../engine/sage';
import { useSurv } from '../engine/store';
import type { Surv } from '../engine/types';
import { colors, radius } from '../theme';

const VISIBILITY = ['all', 'public', 'private'] as const;
const RESPONDED = ['all', 'responded', 'not'] as const;
type Visibility = (typeof VISIBILITY)[number];
type Responded = (typeof RESPONDED)[number];

const VISIBILITY_LABEL: Record<Visibility, string> = { all: 'All', public: 'Public', private: 'Private' };
const RESPONDED_LABEL: Record<Responded, string> = { all: 'Any status', responded: 'Responded', not: 'Not yet' };

export function HomeFeed({
  onOpen,
  onGoToProfile,
}: {
  onOpen: (surv: Surv) => void;
  onGoToProfile: () => void;
}) {
  const { me, survs } = useSurv();
  const [scope, setScope] = useState<'network' | 'arena'>('network');
  const [visibility, setVisibility] = useState<Visibility>('all');
  const [responded, setResponded] = useState<Responded>('all');

  const feed = useMemo(() => {
    return survs
      .filter((s) => {
        if (visibility === 'public' && s.audience.kind !== 'public') return false;
        if (visibility === 'private' && s.audience.kind === 'public') return false;
        const voted = s.votes.some((v) => v.userId === me.id) || s.askerId === me.id;
        if (responded === 'responded' && !voted) return false;
        if (responded === 'not' && voted) return false;
        return true;
      })
      .sort((a, b) => {
        const aLive = a.status === 'live' && msRemaining(a) > 0 ? 0 : 1;
        const bLive = b.status === 'live' && msRemaining(b) > 0 ? 0 : 1;
        return aLive - bLive || a.expiresAt - b.expiresAt;
      });
  }, [survs, visibility, responded, me.id]);

  const cycle = <T extends string>(values: readonly T[], current: T): T =>
    values[(values.indexOf(current) + 1) % values.length];

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.scopeRow}>
        <Tap
          style={[styles.scopeBtn, scope === 'network' && styles.scopeBtnOn]}
          onPress={() => setScope('network')}
        >
          <Text style={[styles.scopeText, scope === 'network' && styles.scopeTextOn]}>My Tree</Text>
        </Tap>
        <Tap
          style={[styles.scopeBtn, scope === 'arena' && styles.scopeBtnOn]}
          onPress={() => setScope('arena')}
        >
          <Text style={[styles.scopeText, scope === 'arena' && styles.scopeTextOn]}>The Forest</Text>
        </Tap>
      </View>

      {scope === 'arena' ? (
        <ArenaFeed />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 90 }}>
          <DigestCard onGoToProfile={onGoToProfile} />

          <View style={styles.filterRow}>
            <Ionicons name="funnel-outline" size={12} color={colors.star} />
            <Tap
              style={styles.filterChip}
              onPress={() => setVisibility(cycle(VISIBILITY, visibility))}
            >
              <Text style={styles.filterText}>{VISIBILITY_LABEL[visibility]}</Text>
              <Ionicons name="chevron-down" size={11} color={colors.star} />
            </Tap>
            <Tap
              style={styles.filterChip}
              onPress={() => setResponded(cycle(RESPONDED, responded))}
            >
              <Text style={styles.filterText}>{RESPONDED_LABEL[responded]}</Text>
              <Ionicons name="chevron-down" size={11} color={colors.star} />
            </Tap>
            <Text style={styles.count}>{feed.length} SURV{feed.length === 1 ? '' : 's'}</Text>
          </View>

          {feed.map((surv) => (
            <SurvCard key={surv.id} surv={surv} onOpen={onOpen} />
          ))}
          {feed.length === 0 && (
            <Text style={styles.empty}>Nothing on this branch — post a SURV and let your Nest decide.</Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scopeRow: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginBottom: 10,
    backgroundColor: colors.nightCard,
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  scopeBtn: { flex: 1, paddingVertical: 7, borderRadius: 9, alignItems: 'center' },
  scopeBtnOn: { backgroundColor: colors.sage },
  scopeText: { color: colors.star, fontWeight: '600', fontSize: 12.5 },
  scopeTextOn: { color: colors.navy, fontWeight: '700' },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.nightCard,
    borderRadius: radius.chip,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filterText: { color: colors.star, fontSize: 11.5, fontWeight: '600' },
  count: { color: colors.inkFaint, fontSize: 11, marginLeft: 'auto' },
  empty: { color: colors.star, textAlign: 'center', marginTop: 40, paddingHorizontal: 30 },
});
