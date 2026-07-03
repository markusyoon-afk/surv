// First-run explainer — three beats of the SURV loop, then get out of the way.

import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Tap } from './Tap';
import { colors, radius } from '../theme';

const BEATS: Array<[string, string, string]> = [
  ['🪺', 'Build your Nests', 'Your spheres of influence — family, foodies, crew. Post decisions to the people who actually know you.'],
  ['⚖️', 'Votes are weighted', 'Every vote counts by SAGE: proven expertise, closeness, and who has steered you right before.'],
  ['👍', 'Swipe the verdict', 'Act on the result, then grade it. Good call or bad, SURV learns whose advice to trust next time.'],
];

export function Onboarding({
  defaultName,
  onDone,
}: {
  defaultName: string;
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState(defaultName);
  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.logo}>🦉 SURV</Text>
        <Text style={styles.tagline}>Live it! SURV it!</Text>
        <Text style={styles.brand}>
          A SURV is a survey that serves — you lend your wisdom, others lend theirs.
          The owl is the sage in you; your Tree holds your Nests, and the Forest holds everyone’s.
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
        <Text style={styles.nameLabel}>What should your Nest call you?</Text>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={colors.inkFaint}
        />
        <Tap
          style={[styles.cta, !name.trim() && { opacity: 0.45 }]}
          onPress={() => name.trim() && onDone(name)}
        >
          <Text style={styles.ctaText}>Let’s SURV</Text>
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
  beat: { flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'flex-start' },
  beatEmoji: { fontSize: 28 },
  beatTitle: { color: colors.ink, fontWeight: '800', fontSize: 15.5 },
  beatBody: { color: colors.inkSoft, fontSize: 13.5, lineHeight: 19, marginTop: 2 },
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
    marginBottom: 14,
  },
  cta: {
    backgroundColor: colors.owl,
    borderRadius: radius.card,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 6,
  },
  ctaText: { color: colors.white, fontWeight: '900', fontSize: 16.5, letterSpacing: 0.5 },
});
