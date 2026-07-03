// "This week in your Nest" — the activity digest on the home feed.

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tap } from './Tap';
import { buildDigest } from '../engine/digest';
import { useSurv } from '../engine/store';
import { colors, radius } from '../theme';

export function DigestCard({ onGoToProfile }: { onGoToProfile: () => void }) {
  const { me, users, nests, survs } = useSurv();
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const items = useMemo(
    () => buildDigest(me, users, nests, survs),
    [me, users, nests, survs],
  );
  if (dismissed || items.length === 0) return null;

  // Collapsed by default: one line, the feed stays the star of the screen.
  if (!open) {
    return (
      <Tap style={styles.line} onPress={() => setOpen(true)}>
        <Ionicons name={items[0].icon as keyof typeof Ionicons.glyphMap} size={13} color={colors.sage} />
        <Text style={styles.lineText} numberOfLines={1}>
          {items[0].text}
        </Text>
        {items.length > 1 && <Text style={styles.more}>+{items.length - 1}</Text>}
        <Ionicons name="chevron-down" size={13} color={colors.star} />
      </Tap>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>THIS WEEK IN YOUR NEST</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tap onPress={() => setOpen(false)} hitSlop={10}>
            <Ionicons name="chevron-up" size={15} color={colors.star} />
          </Tap>
          <Tap onPress={() => setDismissed(true)} hitSlop={10}>
            <Ionicons name="close" size={15} color={colors.star} />
          </Tap>
        </View>
      </View>
      {items.map((item, i) => (
        <Tap
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
        </Tap>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.nightCard,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: 'rgba(78,201,180,0.25)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginHorizontal: 14,
    marginBottom: 10,
  },
  lineText: { color: colors.white, fontSize: 12, fontWeight: '600', flex: 1 },
  more: { color: colors.sage, fontSize: 11, fontWeight: '800' },
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
