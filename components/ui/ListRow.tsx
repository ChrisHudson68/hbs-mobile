import { SymbolViewProps } from 'expo-symbols';
import { ReactNode } from 'react';
import { StyleSheet, Switch, Text as RNText, View, ViewStyle } from 'react-native';

import { useTheme } from '../../src/mobile/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/Text';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';

/** SF Symbol name (the broad expo-symbols contract). */
type SFSymbolName = SymbolViewProps['name'];

type ListRowTrailing = 'chevron' | 'text' | 'switch' | 'badge' | 'custom' | 'none';

// Minimal trailing-badge shape aligned with the 01-05 BadgeProps surface. Typed
// locally (NOT imported from Badge.tsx, which does not exist yet) and rendered
// inline as a styled pill — see SUMMARY note.
type TrailingBadge = {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
};

// HIG list-row layout constant (pt) — not a design token.
const LIST_ROW_MIN_HEIGHT = 56;
const ICON_SIZE = 20;
const CHEVRON_SIZE = 16;

type ListRowProps = {
  title: string;
  subtitle?: string;
  leadingIcon?: SFSymbolName;
  trailing?: ListRowTrailing;
  /** When trailing='text'. */
  trailingText?: string;
  /** When trailing='badge'. */
  trailingBadge?: TrailingBadge;
  /** When trailing='custom'. */
  trailingCustom?: ReactNode;
  onPress?: () => void;
  /** Renders the title in danger tone. */
  destructive?: boolean;
  testID?: string;
};

/**
 * List item over `Pressable` (or `View` when not pressable). Token-only via
 * useTheme(). Renders a leadingIcon, title/subtitle (kit Text), and one of six
 * trailing variants ('chevron'|'text'|'switch'|'badge'|'custom'|'none'). minHeight
 * 56pt (HIG), bottom divider via colors.divider by default. trailing='switch'
 * renders an RN Switch with navy track. destructive shows the title in danger tone.
 */
export function ListRow({
  title,
  subtitle,
  leadingIcon,
  trailing = 'none',
  trailingText,
  trailingBadge,
  trailingCustom,
  onPress,
  destructive = false,
  testID,
}: ListRowProps) {
  const { colors, spacing, radius, typographyRamp } = useTheme();

  const containerStyle: ViewStyle = {
    minHeight: LIST_ROW_MIN_HEIGHT,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  };

  function renderTrailing() {
    switch (trailing) {
      case 'chevron':
        return (
          <IconSymbol name={'chevron.right' as never} size={CHEVRON_SIZE} color={colors.mutedLight} />
        );
      case 'text':
        return trailingText ? (
          <Text variant="subhead" tone="muted">
            {trailingText}
          </Text>
        ) : null;
      case 'switch':
        return (
          <Switch
            value={false}
            trackColor={{ false: colors.border, true: colors.navySurface }}
            onValueChange={onPress}
          />
        );
      case 'badge': {
        if (!trailingBadge) return null;
        // tone -> {bg, label} per the UI-SPEC Badge tone contract. Applied inline
        // (the kit Text has no color-override prop, and its tone set lacks
        // info/accent), so the label color is set directly on RNText.
        const badgeTone = trailingBadge.tone ?? 'neutral';
        const toneColors: Record<NonNullable<TrailingBadge['tone']>, { bg: string; label: string }> = {
          neutral: { bg: colors.muted, label: colors.inverse },
          success: { bg: colors.successBg, label: colors.success },
          warning: { bg: colors.warningBg, label: colors.warning },
          danger: { bg: colors.dangerBg, label: colors.danger },
          info: { bg: colors.infoBg, label: colors.infoText },
          accent: { bg: colors.yellow, label: colors.text },
        };
        const { bg, label } = toneColors[badgeTone];
        return (
          <View
            style={[
              s.badge,
              { backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: spacing.sm },
            ]}
          >
            <RNText
              style={{
                color: label,
                fontSize: typographyRamp.caption.fontSize,
                fontWeight: typographyRamp.caption.fontWeight,
                lineHeight: typographyRamp.caption.lineHeight,
              }}
            >
              {trailingBadge.label}
            </RNText>
          </View>
        );
      }
      case 'custom':
        return trailingCustom ?? null;
      case 'none':
      default:
        return null;
    }
  }

  const content = (
    <View style={[s.row, containerStyle]}>
      {leadingIcon ? (
        <IconSymbol name={leadingIcon as never} size={ICON_SIZE} color={colors.navy} />
      ) : null}
      <View style={s.body}>
        <Text variant="body" tone={destructive ? 'danger' : 'default'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {renderTrailing()}
    </View>
  );

  if (onPress && trailing !== 'switch') {
    return (
      <AnimatedPressable onPress={onPress} testID={testID}>
        {content}
      </AnimatedPressable>
    );
  }

  return (
    <View testID={testID}>{content}</View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
  badge: {
    alignSelf: 'center',
    justifyContent: 'center',
  },
});
