import { SymbolViewProps } from 'expo-symbols';
import { useState } from 'react';
import {
  KeyboardTypeOptions,
  ReturnKeyTypeOptions,
  StyleSheet,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';

import { useTheme } from '../../src/mobile/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/Text';

/** SF Symbol name (the broad expo-symbols contract). */
type SFSymbolName = SymbolViewProps['name'];

// Border widths (pt) per UI-SPEC: default 1pt, focused/error 2pt. HIG layout
// constants, not design tokens — module-scope named constants.
const BORDER_WIDTH_DEFAULT = 1;
const BORDER_WIDTH_ACTIVE = 2;
const ICON_SIZE = 20;

type InputProps = {
  /** Renders above the field in Text variant="footnote". */
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  /** Renders below in danger tone, footnote variant, 1 line max. */
  error?: string;
  /** Optional 1-line helper below the field (muted footnote). Hidden when `error` is set (error wins). */
  helper?: string;
  leftIcon?: SFSymbolName;
  rightIcon?: SFSymbolName;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  placeholder?: string;
  editable?: boolean;
  testID?: string;
};

/**
 * Labeled controlled text field over `TextInput`. Token-only via useTheme().
 * Border state priority is error > focused > default: default colors.border 1pt,
 * focused colors.navy 2pt (tracked via local state + onFocus/onBlur), error
 * colors.danger 2pt plus a 1-line error string below. Label/error reuse the kit
 * Text component. Icon slots render via IconSymbol (SF Symbols).
 */
export function Input({
  label,
  value,
  onChangeText,
  error,
  helper,
  leftIcon,
  rightIcon,
  secureTextEntry = false,
  keyboardType = 'default',
  returnKeyType = 'done',
  placeholder,
  editable = true,
  testID,
}: InputProps) {
  const { colors, spacing, radius, typographyRamp } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const hasError = !!error;

  // Border priority: error > focused > default.
  const borderColor = hasError ? colors.danger : isFocused ? colors.navy : colors.border;
  const borderWidth = hasError || isFocused ? BORDER_WIDTH_ACTIVE : BORDER_WIDTH_DEFAULT;

  const wrapperStyle: ViewStyle = { gap: spacing.xs };

  const fieldStyle: ViewStyle = {
    backgroundColor: colors.card,
    borderColor,
    borderWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  };

  const inputTextStyle = {
    color: colors.text,
    fontSize: typographyRamp.body.fontSize,
    lineHeight: typographyRamp.body.lineHeight,
    paddingVertical: spacing.sm,
  };

  return (
    <View style={[s.wrapper, wrapperStyle]}>
      {label ? (
        <Text variant="footnote" tone="muted">
          {label}
        </Text>
      ) : null}

      <View style={[s.field, fieldStyle]}>
        {leftIcon ? (
          <IconSymbol name={leftIcon as never} size={ICON_SIZE} color={colors.muted} />
        ) : null}
        <TextInput
          style={[s.input, inputTextStyle]}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedLight}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          returnKeyType={returnKeyType}
          editable={editable}
          testID={testID}
        />
        {rightIcon ? (
          <IconSymbol name={rightIcon as never} size={ICON_SIZE} color={colors.muted} />
        ) : null}
      </View>

      {hasError ? (
        <Text variant="footnote" tone="danger" numberOfLines={1}>
          {error}
        </Text>
      ) : helper ? (
        <Text variant="footnote" tone="muted" numberOfLines={1}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {},
  field: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
  },
});
