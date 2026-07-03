// The Nest — home feed. Original beta filters: All/Public/Private + Responded/Not.

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArenaFeed } from '../components/ArenaFeed';
import { DigestCard } from '../components/DigestCard';
import { DraftCards } from '../components/DraftCards';
import { SurvCard } from '../components/SurvCard';
import type { SurvDraft } from '../engine/drafts';
import { msRemaining } from '../engine/sage';
import { useSurv } from '../engine/store';
import type { Surv } from '../engine/types';
import { colors, radius } from '../theme';

type Visibility = 'all' | 'public' | 'private';
type Responded = 'all' | 'responded' | 'not';

export function HomeFeed({
  onOpen,
  onDraft,
  onGoToProfile,
}: {
  onOpen: (surv: Surv) => void;
  onDraft: (draft: SurvDraft) => void;
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

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.scopeRow}>
        <Pressable
          style={[styles.scopeBtn, scope === 'network' && styles.scopeBtnOn]}
          onPress={() => setScope('network')}
        >
          <Text style={[styles.scopeText, scope === 'network' && styles.scopeTextOn]}>My Network</Text>
        </Pressable>
        <Pressable
          style={[styles.scopeBtn, scope === 'arena' && styles.scopeBtnOn]}
          onPress={() => setScope('arena')}
        >
          <Text style={[styles.scopeText, scope === 'arena' && styles.scopeTextOn]}>🌍 Public arena</Text>
        </Pressable>
      </View>

      {scope === 'arena' ? (
        <ArenaFeed />
      ) : (
        <>
          <DraftCards horizontal onSelect={onDraft} />
          <DigestCard onGoToProfile={onGoToProfile} />
          <View style={styles.filters}>
        <FilterGroup
          value={visibility}
          onChange={setVisibility}
          options={[
            ['all', 'All'],
            ['public', 'Public'],
            ['private', 'Private'],
          ]}
        />
        <FilterGroup
          value={responded}
          onChange={setResponded}
          options={[
            ['all', 'All'],
            ['responded', 'Responded'],
            ['not', 'Not yet'],
          ]}
        />
      </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 90 }}>
            {feed.map((surv) => (
              <SurvCard key={surv.id} surv={surv} onOpen={onOpen} />
            ))}
            {feed.length === 0 && (
              <Text style={styles.empty}>Nothing here — post a SURV and let your Nest decide.</Text>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

function FilterGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<[T, string]>;
}) {
  return (
    <View style={styles.group}>
      {options.map(([key, label]) => (
        <Pressable
          key={key}
          style={[styles.chip, value === key && styles.chipOn]}
          onPress={() => onChange(key)}
        >
          <Text style={[styles.chipText, value === key && styles.chipTextOn]}>{label}</Text>
        </Pressable>
      ))}
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
  filters: { paddingHorizontal: 14, paddingBottom: 10, gap: 6 },
  group: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.chip,
    backgroundColor: colors.nightCard,
  },
  chipOn: { backgroundColor: colors.sage },
  chipText: { color: colors.star, fontSize: 12.5, fontWeight: '600' },
  chipTextOn: { color: colors.navy },
  empty: { color: colors.star, textAlign: 'center', marginTop: 40, paddingHorizontal: 30 },
});
