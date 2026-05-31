import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, useColorScheme, View, ViewStyle } from 'react-native';

import { formatDate, formatDateInputValue } from '../../src/mobile/utils';
import { useTheme } from '../../src/mobile/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/Text';

// Border widths (pt) — mirror Input.tsx: default 1pt, error 2pt. HIG layout
// constants, not design tokens.
const BORDER_WIDTH_DEFAULT = 1;
const BORDER_WIDTH_ACTIVE = 2;
const ICON_SIZE = 20;
// HIG minimum touch target (pt) for the trigger row.
const ROW_MIN_HEIGHT = 44;

type DateFieldProps = {
  /** Renders above the field in Text variant="footnote" (mirrors Input). */
  label?: string;
  /** Selected date; null renders the placeholder. */
  value: Date | null;
  /** Fired with the picked Date when the user changes the selection. */
  onChange: (d: Date) => void;
  /** Renders below in danger tone, footnote variant, 1 line max (mirrors Input). */
  error?: string;
  /** Shown in muted tone when `value` is null. */
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  testID?: string;
};

/**
 * Labeled date picker over `@react-native-community/datetimepicker`. Token-only
 * via useTheme(). A tappable bordered row shows the formatted selected date (or
 * the placeholder when null) plus a calendar SF Symbol; tapping toggles an inline
 * iOS date picker below the row. Label/error reuse the kit Text component, styled
 * to mirror Input.tsx. Works on a plain Screen and inside a gorhom Sheet — the
 * inline picker renders fine in both.
 */
export function DateField({
  label,
  value,
  onChange,
  error,
  placeholder = 'Tap to pick a date',
  minimumDate,
  maximumDate,
  testID,
}: DateFieldProps) {
  const { colors, spacing, radius } = useTheme();
  const scheme = useColorScheme();
  const [isOpen, setIsOpen] = useState(false);

  const hasError = !!error;

  // Border priority mirrors Input: error > default. (No focus state — this is a
  // toggle, not a text field.)
  const borderColor = hasError ? colors.danger : colors.border;
  const borderWidth = hasError ? BORDER_WIDTH_ACTIVE : BORDER_WIDTH_DEFAULT;

  const rowStyle: ViewStyle = {
    backgroundColor: colors.card,
    borderColor,
    borderWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  };

  const displayText = value ? formatDate(formatDateInputValue(value)) : placeholder;

  return (
    <View style={[s.wrapper, { gap: spacing.xs }]}>
      {label ? (
        <Text variant="footnote" tone="muted">
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={() => setIsOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[s.row, rowStyle]}
        testID={testID}
      >
        <IconSymbol name={'calendar' as never} size={ICON_SIZE} color={colors.muted} />
        <Text
          variant="body"
          tone={value ? 'default' : 'muted'}
          numberOfLines={1}
          style={s.value}
        >
          {displayText}
        </Text>
      </Pressable>

      {isOpen ? (
        <DateTimePicker
          value={value ?? new Date()}
          mode="date"
          display="inline"
          accentColor={colors.navy}
          themeVariant={scheme === 'dark' ? 'dark' : 'light'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(_, d) => {
            if (d) onChange(d);
          }}
          testID={testID ? `${testID}-picker` : undefined}
          style={{ marginTop: spacing.xs }}
        />
      ) : null}

      {hasError ? (
        <Text variant="footnote" tone="danger" numberOfLines={1}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ROW_MIN_HEIGHT,
  },
  value: {
    flex: 1,
  },
});
