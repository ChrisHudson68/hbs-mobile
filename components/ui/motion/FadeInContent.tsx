import { useEffect, type ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Motion } from '@/src/mobile/theme';
import { motionEasing } from '@/src/mobile/utils/motionEasing';

// [TUNABLE] initial downward offset (px). Emil: nothing appears from nothing —
// pair the opacity fade with a small lift.
const FADE_TRANSLATE_Y = 8;

export type FadeInContentProps = {
  children: ReactNode;
  /** Animate in when true (e.g. once data has loaded). Default true. */
  visible?: boolean;
  /** Delay before the fade starts (ms). Default 0. */
  delay?: number;
  /** Fade duration (ms). Default Motion.base. */
  duration?: number;
  /** Initial translateY offset (px). Default 8. Ignored under reduced motion. */
  translateY?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Fades + lifts content in (opacity 0→1, slight translateY → 0) using the
 * strong ease-out curve. Gate it with `visible` to reveal once data loads.
 * Reduced motion keeps the opacity fade but drops the movement. Worklet-safe
 * via sv.get()/sv.set() under React Compiler (D-12).
 */
export function FadeInContent({
  children,
  visible = true,
  delay = 0,
  duration = Motion.base.duration,
  translateY = FADE_TRANSLATE_Y,
  style,
  testID,
}: FadeInContentProps) {
  const reduced = useReducedMotion();
  const offset = reduced ? 0 : translateY;
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      const anim = withTiming(1, {
        duration,
        easing: motionEasing('decelerate'),
      });
      progress.set(delay > 0 ? withDelay(delay, anim) : anim);
    } else {
      progress.set(0);
    }
    // Stop a still-running tween if we unmount mid-fade (house pattern).
    return () => cancelAnimation(progress);
  }, [visible, delay, duration, progress]);

  // `offset` is consumed in useAnimatedStyle (re-created per render → picks up
  // reduced-motion live), so it is intentionally NOT an effect dependency.
  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: interpolate(progress.get(), [0, 1], [offset, 0]) }],
  }));

  return (
    <Animated.View style={[animStyle, style]} testID={testID}>
      {children}
    </Animated.View>
  );
}
