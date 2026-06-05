import { ReactNode } from 'react';
import { Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

import { Motion } from '@/src/mobile/theme';
import { motionEasing } from '@/src/mobile/utils/motionEasing';

// D-09: subtle scale+dim on press that springs back — no bouncy exaggeration.
// [TUNABLE] starting values; scale never below 0.95.
const PRESS_SCALE = 0.97;
const PRESS_OPACITY = 0.88;

type AnimatedPressableProps = {
  onPress: () => void;
  children: ReactNode;
  testID?: string;
  /** Forwarded to the Animated.View wrapper — prevents layout collapse (Pitfall 7). */
  style?: StyleProp<ViewStyle>;
};

/**
 * Press-feedback wrapper applying a subtle scale+dim on press-in and
 * springing back on press-out. Worklet-safe under React Compiler via
 * sv.get()/sv.set() (D-12). Use in place of a plain Pressable wherever
 * the MOTION-03 / D-09 press affordance is required (ListRow, Card).
 */
export function AnimatedPressable({
  onPress,
  children,
  testID,
  style,
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // sv.get() inside useAnimatedStyle — React Compiler-compliant (D-12).
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
    opacity: opacity.get(),
  }));

  function handlePressIn() {
    scale.set(
      withTiming(PRESS_SCALE, {
        duration: Motion.fast.duration,
        easing: motionEasing(Motion.fast.easing),
      }),
    );
    opacity.set(withTiming(PRESS_OPACITY, { duration: Motion.fast.duration }));
  }

  function handlePressOut() {
    scale.set(withSpring(1.0, { damping: 18, stiffness: 250 }));
    opacity.set(withTiming(1, { duration: Motion.fast.duration }));
  }

  return (
    <Pressable
      testID={testID}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      {/* s.fill (flex:1 + width:'100%') prevents Animated.View from collapsing
          the Card/ListRow layout (06-RESEARCH Pitfall 7). The forwarded `style`
          prop allows callers to pass additional width/flex constraints. */}
      <Animated.View style={[s.fill, animStyle, style]}>{children}</Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fill: {
    flex: 1,
    width: '100%',
  },
});
