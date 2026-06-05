import { StyleSheet, Text as RNText, View } from 'react-native';

import { useTheme } from '../../src/mobile/theme';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
type BadgeSize = 'sm' | 'md';

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  size?: BadgeSize;
  testID?: string;
};

// Badge label font sizes (pt) per UI-SPEC — sm/md. Badge-local, not design tokens.
const BADGE_FONT_SIZE: Record<BadgeSize, number> = { sm: 10, md: 12 };
const BADGE_FONT_WEIGHT = '600' as const;

/**
 * Status pill. Maps `tone` -> a {bg,label} color pair (mirrors the ListRow
 * trailing-badge contract) and renders pill-shaped via radius.pill. Self-sizing
 * via alignSelf 'flex-start'. Token-only via useTheme(); no raw hex.
 */
export function Badge({ label, tone = 'neutral', size = 'md', testID }: BadgeProps) {
  const { colors, spacing, radius } = useTheme();

  const toneColors: Record<BadgeTone, { bg: string; label: string }> = {
    neutral: { bg: colors.muted, label: colors.inverse },
    success: { bg: colors.successBg, label: colors.success },
    warning: { bg: colors.warningBg, label: colors.warning },
    danger: { bg: colors.dangerBg, label: colors.danger },
    info: { bg: colors.infoBg, label: colors.infoText },
    accent: { bg: colors.yellow, label: colors.text },
  };

  const { bg, label: labelColor } = toneColors[tone];

  return (
    <View
      testID={testID}
      style={[
        s.pill,
        {
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        },
      ]}
    >
      <RNText
        style={{ color: labelColor, fontSize: BADGE_FONT_SIZE[size], fontWeight: BADGE_FONT_WEIGHT }}
      >
        {label}
      </RNText>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
  },
});
