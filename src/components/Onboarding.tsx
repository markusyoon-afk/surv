// First-run setup — YOUR profile, not a hand-me-down: name yourself, pick
// your owl, learn the three beats of the loop, and plant your Tree.

import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { OWL_PALETTES, OwlAvatar } from './OwlAvatar';
import { Tap } from './Tap';
import { colors, radius } from '../theme';

const BEATS: Array<[string, string, string]> = [
  ['🪺', 'Ask your people', 'Post a decision to your Nests — family, foodies, crew. The people who actually know you.'],
  ['⚖️', 'Votes are weighted', 'Every vote counts by SAGE: proven expertise, closeness, and who has steered you right before.'],
  ['👍', 'Swipe the verdict', 'Act on any option, then grade it. SURV learns whose advice to trust next time.'],
];

export function Onboarding({ onDone }: { onDone: (name: string, palette?: string) => void }) {
  const [name, setName] = useState('');
  const [palette, setPalette] = useState('g');
  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.logo}>🦉 SURV</Text>
        <Text style={styles.tagline}>Live it! SURV it!</Text>
        <Text style={styles.brand}>
          A SURV is a survey that serves — you lend your wisdom, others lend theirs.
        </Text>
        {BEATS.map(([emoji, title, body]) => (
          <View key={title} style={styles.beat}>
            <Text style={styles.beatEmoji}>{emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.beatTitle}>{title}</Text>
              <Text style={styles.beatBody}>{body}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.nameLabel}>What should your circle call you?</Text>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.inkFaint}
          autoFocus
        />

        <Text style={styles.nameLabel}>Pick your owl</Text>
        <View style={styles.owlRow}>
          <OwlAvatar clout={30} size={46} styleCfg={{ palette }} />
          <View style={styles.swatches}>
            {OWL_PALETTES.map((p) => (
              <Tap
                key={p.id}
                style={[styles.swatch, palette === p.id && styles.swatchOn]}
                onPress={() => setPalette(p.id)}
              >
                <Text style={styles.swatchText}>{p.label}</Text>
              </Tap>
            ))}
          </View>
        </View>
        <Text style={styles.hatch}>
          Everyone hatches at 30% — your owl grows with every good call you help make.
        </Text>

        <Tap
          style={[styles.cta, !name.trim() && { opacity: 0.45 }]}
          onPress={() => name.trim() && onDone(name, palette)}
        >
          <Text style={styles.ctaText}>Plant my Tree</Text>
        </Tap>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,22,36,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 420,
  },
  logo: { color: colors.owlDeep, fontSize: 27, fontFamily: 'SpaceGrotesk_700Bold', textAlign: 'center', letterSpacing: 2 },
  tagline: { color: colors.inkSoft, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  brand: { color: colors.inkSoft, fontSize: 12, textAlign: 'center', lineHeight: 17, marginBottom: 14, fontStyle: 'italic' },
  beat: { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  beatEmoji: { fontSize: 26 },
  beatTitle: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  beatBody: { color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 2 },
  nameLabel: { color: colors.inkSoft, fontWeight: '800', fontSize: 12.5, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  nameInput: {
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.chip,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: colors.ink,
    fontWeight: '700',
    marginBottom: 12,
  },
  owlRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  swatches: { flexDirection: 'row', gap: 6, flex: 1 },
  swatch: {
    borderRadius: radius.chip,
    borderWidth: 1.5,
    borderColor: colors.chip,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  swatchOn: { borderColor: colors.owl, backgroundColor: 'rgba(58,165,135,0.10)' },
  swatchText: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  hatch: { color: colors.inkFaint, fontSize: 11.5, marginBottom: 12 },
  cta: {
    backgroundColor: colors.owl,
    borderRadius: radius.card,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  ctaText: { color: colors.white, fontWeight: '900', fontSize: 16.5, letterSpacing: 0.5 },
});
