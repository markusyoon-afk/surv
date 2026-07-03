// Progressive disclosure for the light card surfaces: a clean tappable
// header, content only when the user asks for it. The pattern that keeps
// Settings-style screens learnable in top consumer apps.

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tap } from './Tap';
import { colors, radius } from '../theme';

export function Collapse({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  /** One-line teaser shown while collapsed, e.g. "3 connected". */
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.card}>
      <Tap style={styles.head} onPress={() => setOpen(!open)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {!open && !!summary && <Text style={styles.summary}>{summary}</Text>}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.inkSoft} />
      </Tap>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.card, marginBottom: 12 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  title: {
    color: colors.inkSoft,
    fontWeight: '800',
    fontSize: 12.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summary: { color: colors.inkFaint, fontSize: 11.5, marginTop: 2 },
  body: { paddingHorizontal: 14, paddingBottom: 14 },
});
