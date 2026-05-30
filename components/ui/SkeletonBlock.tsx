import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../../src/mobile/theme';

// [TUNABLE] shimmer sweep duration — fast enough to feel alive, slow enough to read.
const SHIMMER_DURATION = 1000;

type SkeletonBlockProps = {
  width: number | string;
  height: number;
  /** Default: radius.sm (8). */
  borderRadius?: number;
  testID?: string;
};

/**
 * Single worklet-safe shimmer rectangle (MOTION-02 / D-08). Animates a
 * linear-gradient sweep using withRepeat+withTiming on the UI thread.
 * Colors come from theme tokens (colors.border base, colors.card highlight)
 * so the block adapts to light and dark mode. Cancels animation on unmount.
 */
export function SkeletonBlock({
  width,
  height,
  borderRadius,
  testID,
}: SkeletonBlockProps) {
  const { colors, radius } = useTheme();
  const effectiveBorderRadius = borderRadius ?? radius.sm;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      withRepeat(withTiming(1, { duration: SHIMMER_DURATION }), -1, true),
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [progress]);

  // sv.get() inside useAnimatedStyle — React Compiler-compliant (D-12).
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.get(), [0, 1], [-200, 200]) },
    ],
  }));

  const blockStyle: ViewStyle = {
    width: width as ViewStyle['width'],
    height,
    borderRadius: effectiveBorderRadius,
    backgroundColor: colors.border,
  };

  return (
    <View
      testID={testID}
      style={[s.container, blockStyle]}
    >
      <Animated.View style={[s.shimmer, shimmerStyle]}>
        <LinearGradient
          colors={[colors.border, colors.card, colors.border]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.gradient}
        />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '200%',
  },
  gradient: {
    flex: 1,
  },
});
