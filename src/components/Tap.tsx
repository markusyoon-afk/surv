// Every button in SURV presses like a physical button: it shrinks under the
// finger, dims, and ticks the haptics where the device supports them
// (Vibration API — Android; iOS Safari has no web vibration).
// Drop-in replacement for Pressable.

import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type TapProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
};

export function Tap({ style, onPressIn, disabled, ...rest }: TapProps) {
  const handlePressIn = (e: GestureResponderEvent) => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(10);
      } catch {
        // haptics are a bonus, never a failure
      }
    }
    onPressIn?.(e);
  };

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      style={({ pressed }) => [style, disabled && pressStyles.disabled, pressed && pressStyles.pressed]}
    />
  );
}

const pressStyles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.94 }], opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
