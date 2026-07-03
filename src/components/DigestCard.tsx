// "This week in your Nest" — the activity digest on the home feed.

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { buildDigest } from '../engine/digest';
import { useSurv } from '../engine/store';
import { colors, radius } from '../theme';

export function DigestCard({ onGoToProfile }: { onGoToProfile: () => void }) {
  const { me, users, nests, survs } = useSurv();
  const [dismissed, setDismissed] = useState(false);
  const items = useMemo(
    () => buildDigest(me, users, nests, survs),
    [me, users, nests, survs],
  );
  if (dismissed || items.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>THIS WEEK IN YOUR NEST</Text>
        <Pressable onPress={() => setDismissed(true)} hitSlop={10}>
          <Ionicons name="close" size={15} color={colors.star} />
        </Pressable>
      </View>
      {items.map((item, i) => (
        <Pressable
          key={i}
          style={styles.row}
          onPress={item.target === 'profile' ? onGoToProfile : undefined}
        >
          <Ionicons
            name={item.icon as keyof typeof Ionicons.glyphMap}
            size={14}
            color={colors.sage}
          />
          <Text style={styles.text}>{item.text}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.nightCard,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: 'rgba(78,201,180,0.25)',
    padding: 12,
    marginHorizontal: 14,
    marginBottom: 10,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  title: { color: colors.sage, fontFamily: 'SpaceGrotesk_500Medium', fontSize: 10.5, letterSpacing: 1.3 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  text: { color: colors.white, fontSize: 12.5, lineHeight: 17, flex: 1, fontWeight: '500' },
});
