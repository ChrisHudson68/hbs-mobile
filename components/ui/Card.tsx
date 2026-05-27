import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '../../src/mobile/theme';

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

  return (
    <View style={[s.base, surfaceStyle]} testID={testID}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  base: {},
});
