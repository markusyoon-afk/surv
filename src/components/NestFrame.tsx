// A bird's-nest visual: woven twig rim around nest cards, built purely from
// layered/rotated Views (no image assets) so it renders on web and native.

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

const TWIG_BROWN = '#8a6b4a';
const TWIG_LIGHT = '#b08d64';
const STRAW = '#d8b98a';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function NestFrame({ seed = 7, children }: { seed?: number; children: React.ReactNode }) {
  // Twigs woven along the top rim — deterministic per nest so it doesn't shimmer.
  const twigs = useMemo(() => {
    const rand = mulberry32(seed);
    return Array.from({ length: 16 }, (_, i) => ({
      key: i,
      left: 4 + i * 6.2 + rand() * 2, // percent
      rotate: -28 + rand() * 56,
      width: 16 + rand() * 16,
      light: rand() > 0.5,
    }));
  }, [seed]);

  return (
    <View style={styles.outer}>
      <View style={styles.rim}>
        {twigs.map((t) => (
          <View
            key={t.key}
            style={[
              styles.twig,
              {
                left: `${t.left}%`,
                width: t.width,
                transform: [{ rotate: `${t.rotate}deg` }],
                backgroundColor: t.light ? TWIG_LIGHT : TWIG_BROWN,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.inner}>{children}</View>
      <View style={styles.rimBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 22,
    backgroundColor: TWIG_BROWN,
    padding: 5,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#6f5238',
  },
  rim: {
    height: 14,
    marginBottom: -6,
    zIndex: 2,
    overflow: 'visible',
  },
  twig: {
    position: 'absolute',
    top: 4,
    height: 4,
    borderRadius: 2,
  },
  inner: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: STRAW,
  },
  rimBottom: {
    height: 5,
    marginTop: 3,
    marginHorizontal: 24,
    borderRadius: 3,
    backgroundColor: TWIG_LIGHT,
    opacity: 0.7,
  },
});
