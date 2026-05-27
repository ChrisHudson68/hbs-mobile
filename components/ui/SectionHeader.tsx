import { ReactNode } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';

import { useTheme } from '../../src/mobile/theme';

export type SectionHeaderProps = {
  title: string;
  /** Optional right-aligned action slot (e.g. an "Edit" link or count). */
  action?: ReactNode;
  testID?: string;
};

/**
 * Uppercase footnote section label in `colors.muted`, with an optional right
 * action slot. Sits above a grouped list/card. Token-only via useTheme().
 */
export function SectionHeader({ title, action, testID }: SectionHeaderProps) {
  const { colors, spacing, typographyRamp } = useTheme();

  return (
    <View
      testID={testID}
      style={[s.row, { paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}
    >
      <RNText
        style={[
          s.title,
          {
            color: colors.muted,
            fontSize: typographyRamp.footnote.fontSize,
            lineHeight: typographyRamp.footnote.lineHeight,
          },
        ]}
      >
        {title}
      </RNText>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
