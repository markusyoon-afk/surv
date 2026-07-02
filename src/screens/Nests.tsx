// Nests — your spheres of influence, with each member's Clout and top SAGE.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSurv } from '../engine/store';
import type { Category } from '../engine/types';
import { colors, radius } from '../theme';

const TIER_LABEL = { inner: 'Inner circle', regular: 'Regular', outer: 'Outer' } as const;

export function Nests() {
  const { me, nests, userById } = useSurv();
  const mine = nests.filter(
    (n) => n.ownerId === me.id || n.members.some((m) => m.userId === me.id),
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 100 }}>
      {mine.map((nest) => (
        <View key={nest.id} style={styles.card}>
          <Text style={styles.name}>
            {nest.emoji} {nest.name}
            {nest.ownerId === me.id ? '  · yours' : ''}
          </Text>
          {nest.members.map((m) => {
            const user = userById(m.userId);
            if (!user) return null;
            const top = topSage(user.categorySage);
            return (
              <View key={m.userId} style={styles.memberRow}>
                <Text style={{ fontSize: 20 }}>{user.avatar}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>
                    {user.id === me.id ? 'You' : user.name}
                  </Text>
                  <Text style={styles.memberMeta}>
                    {TIER_LABEL[m.tier]}
                    {top ? ` · ${top.category} sage ${top.value}%` : ''}
                  </Text>
                </View>
                <View style={styles.cloutPill}>
                  <Text style={styles.cloutText}>{Math.round(user.clout)}%</Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
      <Text style={styles.hint}>
        Nest closeness feeds each member’s voting weight on your SURVs. Inner circle
        counts most; outcomes teach SURV who your real sages are.
      </Text>
    </ScrollView>
  );
}

function topSage(
  sage: Partial<Record<Category, number>>,
): { category: string; value: number } | null {
  const entries = Object.entries(sage) as Array<[string, number]>;
  if (entries.length === 0) return null;
  const [category, value] = entries.sort((a, b) => b[1] - a[1])[0];
  return { category, value: Math.round(value) };
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.card, padding: 14, marginBottom: 12 },
  name: { color: colors.owlDeep, fontWeight: '900', fontSize: 16, marginBottom: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  memberName: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  memberMeta: { color: colors.inkSoft, fontSize: 12 },
  cloutPill: { backgroundColor: colors.sage, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  cloutText: { color: colors.navy, fontWeight: '800', fontSize: 12.5 },
  hint: { color: colors.star, fontSize: 12.5, paddingHorizontal: 6, fontStyle: 'italic' },
});
