import { useEffect, type ReactNode } from 'react';
import {
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Motion, Spring } from '@/src/mobile/theme';
import { motionEasing } from '@/src/mobile/utils/motionEasing';
import { hapticSelection } from '@/src/mobile/utils/haptics';

// Canonical press affordance (Premium-Feel W0): scale + dim on press-in, snappy
// spring-back on release, optional selection haptic. SUPERSEDES the ad-hoc
// AnimatedPressable; consumers (Card / ListRow) migrate in W2, then it is
// deleted. Worklet-safe via sv.get()/sv.set() under React Compiler (D-12).
const PRESS_SCALE = 0.97; // [TUNABLE] never below 0.95.
const PRESS_OPACITY = 0.88; // matches AnimatedPressable until W2 consolidation.

type PressableScaleProps = {
  onPress?: () => void;
  onLongPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale target on press. Default 0.97. */
  scaleTo?: number;
  /** Fire a selection haptic on press-in. Default true. */
  haptic?: boolean;
  disabled?: boolean;
  /** Announced by screen readers — set for icon-only / non-text controls. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  hitSlop?: PressableProps['hitSlop'];
  testID?: string;
};

export function PressableScale({
  onPress,
  onLongPress,
  children,
  style,
  scaleTo = PRESS_SCALE,
  haptic = true,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  hitSlop,
  testID,
}: PressableScaleProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // Cancel any in-flight press animation on unmount (house pattern, SkeletonBlock).
  useEffect(
    () => () => {
      cancelAnimation(scale);
      cancelAnimation(opacity);
    },
    [scale, opacity],
  );

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
    opacity: opacity.get(),
  }));

  function handlePressIn() {
    if (disabled) return;
    if (haptic) hapticSelection();
    scale.set(
      withTiming(scaleTo, {
        duration: Motion.fast.duration,
        easing: motionEasing(Motion.fast.easing),
      }),
    );
    opacity.set(withTiming(PRESS_OPACITY, { duration: Motion.fast.duration }));
  }

  function handlePressOut() {
    if (disabled) return;
    scale.set(withSpring(1, Spring.snappy));
    opacity.set(withTiming(1, { duration: Motion.fast.duration }));
  }

  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <Animated.View style={[s.fill, animStyle, style]}>{children}</Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, width: '100%' },
});
