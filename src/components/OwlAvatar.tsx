// Your owl evolves as your SAGEmeter climbs — from Hatchling all the way to
// the Super Sage Owl (mask and cape earned, not given).

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export interface AvatarStage {
  stage: number;
  label: string;
  minClout: number;
  img: number; // static asset id from require()
}

export const AVATAR_STAGES: AvatarStage[] = [
  { stage: 1, label: 'Hatchling', minClout: 0, img: require('../../assets/avatars/stage1.png') },
  { stage: 2, label: 'Owl', minClout: 40, img: require('../../assets/avatars/stage2.png') },
  { stage: 3, label: 'Sage', minClout: 60, img: require('../../assets/avatars/stage3.png') },
  { stage: 4, label: 'Masked Sage', minClout: 75, img: require('../../assets/avatars/stage4.png') },
  { stage: 5, label: 'Super Sage Owl', minClout: 90, img: require('../../assets/avatars/stage5.png') },
];

export function stageForClout(clout: number): AvatarStage {
  let current = AVATAR_STAGES[0];
  for (const s of AVATAR_STAGES) if (clout >= s.minClout) current = s;
  return current;
}

export function nextStage(clout: number): AvatarStage | null {
  return AVATAR_STAGES.find((s) => s.minClout > clout) ?? null;
}

export function OwlAvatar({
  clout,
  size = 44,
  showLabel = false,
}: {
  clout: number;
  size?: number;
  showLabel?: boolean;
}) {
  const stage = stageForClout(clout);
  return (
    <View style={{ alignItems: 'center' }}>
      <Image source={stage.img} style={{ width: size, height: size }} />
      {showLabel && <Text style={styles.label}>{stage.label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.owlDeep, fontWeight: '800', fontSize: 11.5, marginTop: 2 },
});
