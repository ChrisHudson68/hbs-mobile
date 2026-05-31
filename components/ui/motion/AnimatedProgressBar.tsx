import { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Motion, useTheme } from '@/src/mobile/theme';
import { motionEasing } from '@/src/mobile/utils/motionEasing';

const DEFAULT_HEIGHT = 6; // [TUNABLE]

type AnimatedProgressBarProps = {
  /** 0..1; clamped. */
  progress: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  duration?: number;
  /** Default: pill (height / 2). */
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Progress bar whose fill grows with the strong ease-out curve (withTiming).
 * Jumps instantly under reduced motion. Worklet-safe via sv.get()/sv.set().
 *
 * @remarks Animates `width` (a layout property) — fine for a one-shot,
 * single-instance bar (e.g. the dashboard weekly-goal bar). Do NOT use in
 * lists / many instances or for continuously-updating progress; switch to a
 * transform-scaleX fill there to keep work off the layout thread.
 */
export function AnimatedProgressBar({
  progress,
  height = DEFAULT_HEIGHT,
  trackColor,
  fillColor,
  duration,
  borderRadius,
  style,
  testID,
}: AnimatedProgressBarProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, progress));
  const target = useSharedValue(0);

  useEffect(() => {
    target.set(
      reduced
        ? clamped
        : withTiming(clamped, {
            duration: duration ?? Motion.slow.duration,
            easing: motionEasing('decelerate'),
          }),
    );
    return () => cancelAnimation(target);
  }, [clamped, duration, reduced, target]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${target.get() * 100}%`,
  }));

  const radius = borderRadius ?? height / 2;

  return (
    <View
      testID={testID}
      style={[
        s.track,
        {
          height,
          borderRadius: radius,
          backgroundColor: trackColor ?? colors.border,
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          s.fill,
          { borderRadius: radius, backgroundColor: fillColor ?? colors.navy },
          fillStyle,
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
