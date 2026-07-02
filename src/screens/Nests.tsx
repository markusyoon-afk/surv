// Nests — your spheres of influence. Create new ones, tap a tier to adjust
// closeness (owner only); each member shows Clout and their strongest SAGE.

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSurv } from '../engine/store';
import type { Category } from '../engine/types';
import { colors, radius } from '../theme';

const TIER_LABEL = { inner: 'Inner circle', regular: 'Regular', outer: 'Outer' } as const;
const NEST_EMOJI = ['🪺', '🦉', '🍽️', '🏀', '🎸', '💼', '❤️', '🎮'];

export function Nests() {
  const { me, nests, users, userById, createNest, cycleTier } = useSurv();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(NEST_EMOJI[0]);
  const [memberIds, setMemberIds] = useState<string[]>([]);

  const mine = nests.filter(
    (n) => n.ownerId === me.id || n.members.some((m) => m.userId === me.id),
  );

  const submit = () => {
    if (!name.trim() || memberIds.length === 0) return;
    createNest(name, emoji, memberIds);
    setName('');
    setEmoji(NEST_EMOJI[0]);
    setMemberIds([]);
    setCreating(false);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 100 }}>
      <Pressable style={styles.newBtn} onPress={() => setCreating(!creating)}>
        <Text style={styles.newBtnText}>{creating ? '✕ Cancel' : '＋ New Nest'}</Text>
      </Pressable>

      {creating && (
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Nest name (e.g. Hoops Crew)"
            placeholderTextColor={colors.inkFaint}
            value={name}
            onChangeText={setName}
          />
          <View style={styles.emojiRow}>
            {NEST_EMOJI.map((e) => (
              <Pressable
                key={e}
                style={[styles.emojiChip, emoji === e && styles.emojiChipOn]}
                onPress={() => setEmoji(e)}
              >
                <Text style={{ fontSize: 20 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Who’s in it</Text>
          <View style={styles.memberChips}>
            {users
              .filter((u) => u.id !== me.id)
              .map((u) => {
                const on = memberIds.includes(u.id);
                return (
                  <Pressable
                    key={u.id}
                    style={[styles.memberChip, on && styles.memberChipOn]}
                    onPress={() =>
                      setMemberIds((prev) =>
                        on ? prev.filter((id) => id !== u.id) : [...prev, u.id],
                      )
                    }
                  >
                    <Text style={[styles.memberChipText, on && styles.memberChipTextOn]}>
                      {u.avatar} {u.name} {on ? '✓' : ''}
                    </Text>
                  </Pressable>
                );
              })}
          </View>
          <Pressable
            style={[styles.createBtn, (!name.trim() || memberIds.length === 0) && { opacity: 0.45 }]}
            onPress={submit}
          >
            <Text style={styles.createBtnText}>Create Nest</Text>
          </Pressable>
        </View>
      )}

      {mine.map((nest) => {
        const iOwn = nest.ownerId === me.id;
        return (
          <View key={nest.id} style={styles.card}>
            <Text style={styles.name}>
              {nest.emoji} {nest.name}
              {iOwn ? '  · yours' : ''}
            </Text>
            {nest.members.map((m) => {
              const user = userById(m.userId);
              if (!user) return null;
              const top = topSage(user.categorySage);
              const canCycle = iOwn && m.userId !== me.id;
              return (
                <View key={m.userId} style={styles.memberRow}>
                  <Text style={{ fontSize: 20 }}>{user.avatar}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>
                      {user.id === me.id ? 'You' : user.name}
                    </Text>
                    <Text style={styles.memberMeta}>
                      {top ? `${top.category} sage ${top.value}%` : 'No track record yet'}
                    </Text>
                  </View>
                  <Pressable
                    style={[styles.tierPill, !canCycle && { opacity: 0.75 }]}
                    onPress={canCycle ? () => cycleTier(nest.id, m.userId) : undefined}
                  >
                    <Text style={styles.tierText}>
                      {TIER_LABEL[m.tier]}
                      {canCycle ? ' ⟳' : ''}
                    </Text>
                  </Pressable>
                  <View style={styles.cloutPill}>
                    <Text style={styles.cloutText}>{Math.round(user.clout)}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
      <Text style={styles.hint}>
        Nest closeness feeds each member’s voting weight on your SURVs. Tap a tier to
        adjust it — inner circle counts most. Outcomes teach SURV who your real sages are.
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
  newBtn: {
    backgroundColor: colors.owl,
    borderRadius: radius.card,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 12,
  },
  newBtnText: { color: colors.white, fontWeight: '900', fontSize: 15 },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.chip,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: colors.ink,
    fontWeight: '600',
  },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  emojiChip: { padding: 6, borderRadius: 10, backgroundColor: colors.panelDeep },
  emojiChipOn: { backgroundColor: colors.sage },
  label: { color: colors.inkSoft, fontWeight: '800', fontSize: 12.5, marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  memberChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  memberChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.chip, backgroundColor: colors.panelDeep },
  memberChipOn: { backgroundColor: colors.owl },
  memberChipText: { color: colors.inkSoft, fontWeight: '600', fontSize: 12.5 },
  memberChipTextOn: { color: colors.white },
  createBtn: { backgroundColor: colors.owlDeep, borderRadius: radius.button, paddingVertical: 11, alignItems: 'center', marginTop: 14 },
  createBtnText: { color: colors.white, fontWeight: '800', fontSize: 14.5 },
  name: { color: colors.owlDeep, fontWeight: '900', fontSize: 16, marginBottom: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  memberName: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  memberMeta: { color: colors.inkSoft, fontSize: 12 },
  tierPill: { backgroundColor: colors.panelDeep, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  tierText: { color: colors.inkSoft, fontWeight: '700', fontSize: 11.5 },
  cloutPill: { backgroundColor: colors.sage, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  cloutText: { color: colors.navy, fontWeight: '800', fontSize: 12.5 },
  hint: { color: colors.star, fontSize: 12.5, paddingHorizontal: 6, fontStyle: 'italic' },
});
