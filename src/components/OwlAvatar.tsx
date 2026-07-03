// Your owl evolves as your SAGEmeter climbs — from Hatchling all the way to
// the Super Sage Owl (mask and cape earned, not given).

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { AVATAR_MAP } from './avatarMap';

export const OWL_PALETTES = [
  { id: 'g', label: '🌿 Forest' },
  { id: 'b', label: '💧 Sky' },
  { id: 'r', label: '🪵 Barn' },
];
export const OWL_SHAPES = [
  { id: 'round', label: 'Round' },
  { id: 'tall', label: 'Tall' },
  { id: 'chunky', label: 'Chunky' },
];

/** Deterministic look for any user id — every owl in the Forest is its own bird. */
export function variantFor(id: string): { palette: string; shape: string } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  h = Math.abs(h);
  return { palette: ['g', 'b', 'r'][h % 3], shape: ['round', 'tall', 'chunky'][(h >> 3) % 3] };
}

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

/** Customization catalog — accessories unlock as your SAGEmeter grows. */
export const OWL_ACCESSORIES: Array<{ id: string; emoji: string; label: string; min: number }> = [
  { id: 'none', emoji: '', label: 'Clean', min: 0 },
  { id: 'sprout', emoji: '🌱', label: 'Sprout', min: 0 },
  { id: 'scarf', emoji: '🧣', label: 'Scarf', min: 40 },
  { id: 'shades', emoji: '🕶️', label: 'Shades', min: 60 },
  { id: 'tophat', emoji: '🎩', label: 'Top hat', min: 75 },
  { id: 'crown', emoji: '👑', label: 'Crown', min: 90 },
];

export const OWL_RINGS: Array<{ id: string; color: string; label: string; min: number }> = [
  { id: 'none', color: 'transparent', label: 'None', min: 0 },
  { id: 'sage', color: '#4ec9b4', label: 'Sage', min: 0 },
  { id: 'sky', color: '#6b8fc9', label: 'Sky', min: 40 },
  { id: 'gold', color: '#f2c14e', label: 'Gold', min: 60 },
  { id: 'ember', color: '#c0392b', label: 'Ember', min: 75 },
];

export interface OwlStyleCfg {
  ring?: string;
  accessory?: string;
  palette?: string;
  shape?: string;
}

export function OwlAvatar({
  clout,
  size = 44,
  showLabel = false,
  styleCfg,
  variantOf,
}: {
  clout: number;
  size?: number;
  showLabel?: boolean;
  styleCfg?: OwlStyleCfg;
  /** User id for deterministic per-user looks (others' avatars). */
  variantOf?: string;
}) {
  const stage = stageForClout(clout);
  const auto = variantOf ? variantFor(variantOf) : { palette: 'g', shape: 'round' };
  const palette = styleCfg?.palette ?? auto.palette;
  const shape = styleCfg?.shape ?? auto.shape;
  const img = AVATAR_MAP[stage.stage]?.[palette]?.[shape] ?? stage.img;
  const ring = OWL_RINGS.find((r) => r.id === styleCfg?.ring && clout >= r.min);
  const acc = OWL_ACCESSORIES.find((a) => a.id === styleCfg?.accessory && clout >= a.min);
  return (
    <View style={{ alignItems: 'center' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring && ring.id !== 'none' ? Math.max(2, size / 20) : 0,
          borderColor: ring?.color ?? 'transparent',
        }}
      >
        <Image source={img} style={{ width: '100%', height: '100%' }} />
        {acc && acc.emoji !== '' && (
          <Text
            style={{
              position: 'absolute',
              top: -size * 0.18,
              right: -size * 0.1,
              fontSize: size * 0.42,
            }}
          >
            {acc.emoji}
          </Text>
        )}
      </View>
      {showLabel && <Text style={styles.label}>{stage.label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.owlDeep, fontWeight: '800', fontSize: 11.5, marginTop: 2 },
});
