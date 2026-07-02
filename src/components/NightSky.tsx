// The signature SURV backdrop: navy night sky, stars, crescent moon.

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function NightSky({ children }: { children: React.ReactNode }) {
  const stars = useMemo(() => {
    const rand = mulberry32(2011); // the founding year, obviously
    return Array.from({ length: 46 }, (_, i) => ({
      key: i,
      left: rand() * 100,
      top: rand() * 100,
      size: 1 + rand() * 2.2,
      opacity: 0.35 + rand() * 0.5,
    }));
  }, []);

  return (
    <View style={styles.sky}>
      {stars.map((s) => (
        <View
          key={s.key}
          style={[
            styles.star,
            {
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              borderRadius: s.size,
              opacity: s.opacity,
            },
          ]}
        />
      ))}
      <View style={styles.moon}>
        <View style={styles.moonShadow} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sky: { flex: 1, backgroundColor: colors.night },
  star: { position: 'absolute', backgroundColor: colors.star },
  moon: {
    position: 'absolute',
    top: 34,
    right: 40,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.moon,
    overflow: 'hidden',
  },
  moonShadow: {
    position: 'absolute',
    top: -6,
    right: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.night,
  },
});
