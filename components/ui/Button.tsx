import * as Haptics from 'expo-haptics';
import { SymbolViewProps } from 'expo-symbols';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme } from '../../src/mobile/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';
type ButtonHaptic = 'impact' | 'selection' | 'none';

/** SF Symbol name (the broad expo-symbols contract). */
type SFSymbolName = SymbolViewProps['name'];

// HIG touch-target heights (pt). md = 44pt minimum per Apple HIG. Module-scope
// named constants — not inline magic numbers.
const BUTTON_HEIGHTS: Record<ButtonSize, number> = { sm: 36, md: 44, lg: 52 };

// UI-SPEC disabled affordance: opacity 0.4 (tighter than the legacy login.tsx 0.6).
const DISABLED_OPACITY = 0.4;

const ICON_SIZE = 20;

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Visible label; also used as the accessibilityLabel. */
  label: string;
  onPress: () => void;
  /** Renders an ActivityIndicator only (no label) and disables press. */
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: SFSymbolName;
  rightIcon?: SFSymbolName;
  fullWidth?: boolean;
  /** Haptic fired on press via expo-haptics. */
  haptic?: ButtonHaptic;
  testID?: string;
};

/**
 * 4-variant / 3-size pressable. Token-only via useTheme(). Primary uses
 * colors.yellow (UI-SPEC accent), NOT navy. Loading shows a spinner only;
 * disabled drops opacity to 0.4. Icon slots render via IconSymbol (SF Symbols).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  label,
  onPress,
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  haptic = 'impact',
  testID,
}: ButtonProps) {
  const { colors, spacing, radius, typographyRamp } = useTheme();

  const isInactive = loading || disabled;

  const variantContainer: Record<ButtonVariant, ViewStyle> = {
    primary: { backgroundColor: colors.yellow },
    secondary: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.navy,
    },
    ghost: { backgroundColor: 'transparent' },
    danger: { backgroundColor: colors.danger },
  };

  const variantLabelColor: Record<ButtonVariant, string> = {
    primary: colors.text,
    secondary: colors.navy,
    ghost: colors.navy,
    danger: colors.inverse,
  };

  const labelColor = variantLabelColor[variant];

  const containerStyle: ViewStyle = {
    minHeight: BUTTON_HEIGHTS[size],
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    width: fullWidth ? '100%' : undefined,
    opacity: disabled ? DISABLED_OPACITY : 1,
    ...variantContainer[variant],
  };

  // Label typography comes from the HIG type ramp (headline = 17pt / 600) — not
  // hardcoded numbers. Color is variant-driven.
  const labelStyle: TextStyle = {
    color: labelColor,
    fontSize: typographyRamp.headline.fontSize,
    fontWeight: typographyRamp.headline.fontWeight,
  };

  function fireHaptic() {
    if (haptic === 'impact') {
      void Haptics.impactAsync();
    } else if (haptic === 'selection') {
      void Haptics.selectionAsync();
    }
  }

  function handlePress() {
    fireHaptic();
    onPress();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      onPress={handlePress}
      testID={testID}
      style={({ pressed }) => [s.base, containerStyle, pressed && !isInactive && s.pressed]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <View style={s.content}>
          {leftIcon ? (
            <IconSymbol name={leftIcon as never} size={ICON_SIZE} color={labelColor} />
          ) : null}
          <RNText style={labelStyle}>{label}</RNText>
          {rightIcon ? (
            <IconSymbol name={rightIcon as never} size={ICON_SIZE} color={labelColor} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
