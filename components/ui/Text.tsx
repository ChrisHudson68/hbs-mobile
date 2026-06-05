import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text as RNText, TextStyle } from 'react-native';

import { useTheme } from '../../src/mobile/theme';

type TextVariant =
  | 'largeTitle'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption';

type TextTone = 'default' | 'muted' | 'inverse' | 'danger' | 'success' | 'warning';

type TextWeight = '400' | '600' | '700' | '800';

type TextProps = {
  children: ReactNode;
  /** Maps to the iOS HIG type ramp (IOSTypeRamp). */
  variant?: TextVariant;
  /** Maps to a color token. */
  tone?: TextTone;
  /** Overrides the variant's default fontWeight. */
  weight?: TextWeight;
  numberOfLines?: number;
  /** Optional style override, merged after the computed token style. */
  style?: StyleProp<TextStyle>;
  testID?: string;
};

/**
 * Typography primitive. Maps `variant` -> IOSTypeRamp (fontSize/fontWeight/lineHeight)
 * and `tone` -> a color token. Does NOT replace legacy `Typography.*` usage in
 * unconverted screens — both coexist. Token-only, plain functional component.
 */
export function Text({
  children,
  variant = 'body',
  tone = 'default',
  weight,
  numberOfLines,
  style: styleOverride,
  testID,
}: TextProps) {
  const { colors, typographyRamp } = useTheme();

  const ramp = typographyRamp[variant];

  const toneColor: Record<TextTone, string> = {
    default: colors.text,
    muted: colors.muted,
    inverse: colors.inverse,
    danger: colors.danger,
    success: colors.success,
    warning: colors.warning,
  };

  const style: TextStyle = {
    fontSize: ramp.fontSize,
    fontWeight: weight ?? ramp.fontWeight,
    lineHeight: ramp.lineHeight,
    color: toneColor[tone],
  };

  return (
    <RNText style={[s.base, style, styleOverride]} numberOfLines={numberOfLines} testID={testID}>
      {children}
    </RNText>
  );
}

const s = StyleSheet.create({
  base: {},
});
