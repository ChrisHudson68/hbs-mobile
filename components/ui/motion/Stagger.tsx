import { Children, isValidElement, type ReactNode } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { FadeInContent } from '@/components/ui/motion/FadeInContent';

// [TUNABLE] ms between consecutive siblings. Emil: keep stagger 30–80ms; longer
// makes the UI feel slow.
const STAGGER_STEP = 50;

type StaggerProps = {
  children: ReactNode;
  /** Gate the whole cascade (e.g. once loaded). Default true. */
  visible?: boolean;
  /** Delay between consecutive children (ms). Default 50. */
  delayStep?: number;
  /** Delay before the first child (ms). Default 0. */
  initialDelay?: number;
  /** Per-child fade duration (ms). */
  duration?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Cascades children in with a short per-item delay (FadeInContent each). Use for
 * stat grids / short lists where a waterfall reveal feels more alive than a
 * single block fade. Children must be a STABLE, non-reordering set — for dynamic
 * / reorderable lists pass explicit keys. Under reduced motion the cascade
 * collapses to a simultaneous fade (no staggered timing); per-child opacity
 * handling lives in FadeInContent.
 */
export function Stagger({
  children,
  visible = true,
  delayStep = STAGGER_STEP,
  initialDelay = 0,
  duration,
  style,
  testID,
}: StaggerProps) {
  const reduced = useReducedMotion();
  const items = Children.toArray(children);
  return (
    <View style={style} testID={testID}>
      {items.map((child, i) => {
        const key =
          isValidElement(child) && child.key != null ? child.key : `stagger-${i}`;
        return (
          <FadeInContent
            key={key}
            visible={visible}
            delay={reduced ? 0 : initialDelay + i * delayStep}
            duration={duration}
          >
            {child}
          </FadeInContent>
        );
      })}
    </View>
  );
}
