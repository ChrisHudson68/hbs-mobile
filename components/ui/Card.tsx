import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '../../src/mobile/theme';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';

type CardElevation = 'none' | 'sm' | 'md';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';
type CardTone = 'default' | 'elevated';
type CardRadius = 'sm' | 'md' | 'lg';

type CardProps = {
  children: ReactNode;
  /** Maps to an Elevation token shadow preset (NOT a border stroke). */
  elevation?: CardElevation;
  /** Maps to a Spacing token; 'none' → 0. */
  padding?: CardPadding;
  /** default → colors.card; elevated → colors.cardElevated. */
  tone?: CardTone;
  /** Maps to a Radius token. */
  radius?: CardRadius;
  /**
   * Optional: when set, wraps the card surface in AnimatedPressable so the
   * card gets D-09 scale+dim press feedback (MOTION-03). When absent, Card
   * renders as a plain non-interactive View — zero behavior change for
   * existing callers. Wave-2 consumers (Jobs, Invoices) route their row tap
   * through this prop instead of an outer plain Pressable so MOTION-03 covers
   * the card rows that were previously plain-Pressable+Card (no feedback).
   */
  onPress?: () => void;
  testID?: string;
};

/**
 * Pure surface wrapper over `View`. Token-only via useTheme(). Depth is conveyed
 * by an Elevation-token shadow preset (shadowColor/Opacity/Radius/Offset) — there
 * is deliberately NO border stroke (the more.tsx analog's `borderWidth:1` is
 * replaced by shadow per the UI-SPEC Elevation contract). An opaque background is
 * always set so the iOS shadow actually renders. No built-in header/footer —
 * compose with Text.
 */
export function Card({
  children,
  elevation = 'sm',
  padding = 'md',
  tone = 'default',
  radius = 'md',
  onPress,
  testID,
}: CardProps) {
  const { colors, spacing, radius: radiusTokens, elevation: elevationTokens } = useTheme();

  const paddingValue: Record<CardPadding, number> = {
    none: 0,
    sm: spacing.sm,
    md: spacing.md,
    lg: spacing.lg,
  };

  const surfaceStyle: ViewStyle = {
    backgroundColor: tone === 'elevated' ? colors.cardElevated : colors.card,
    borderRadius: radiusTokens[radius],
    padding: paddingValue[padding],
    ...elevationTokens[elevation],
  };

  const surface = (
    <View style={[s.base, surfaceStyle]} testID={onPress ? undefined : testID}>
      {children}
    </View>
  );

  // When onPress is provided, wrap in AnimatedPressable for D-09 scale+dim
  // press feedback (MOTION-03). AnimatedPressable carries s.fill (flex:1 +
  // width:'100%') to prevent layout collapse (06-RESEARCH Pitfall 7).
  if (onPress != null) {
    return (
      <AnimatedPressable onPress={onPress} testID={testID}>
        {surface}
      </AnimatedPressable>
    );
  }

  return surface;
}

const s = StyleSheet.create({
  base: {},
});
