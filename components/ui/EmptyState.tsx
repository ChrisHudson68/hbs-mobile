import { StyleSheet, View } from 'react-native';
import type { SymbolViewProps } from 'expo-symbols';

import { useTheme } from '../../src/mobile/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';

type EmptyStateProps = {
  /** SF Symbol name for the icon displayed above the message. */
  icon: SymbolViewProps['name'];
  /** Single descriptive line shown in muted subhead type. */
  message: string;
  /** Label for the optional action button. Omit to hide the button entirely. */
  actionLabel?: string;
  /** Handler for the action button. Omit to hide the button entirely. */
  onAction?: () => void;
  testID?: string;
};

/**
 * Empty-list UI (MOTION-02 sibling / D-11). Renders an SF Symbol icon, a
 * single muted message line, and an optional role-gated secondary action
 * button. Mirrors the employees screen empty-state pattern but uses kit
 * Text + Button instead of raw RNText. Pass `actionLabel={undefined}` to
 * suppress the button for non-manager roles — no "no permission" copy.
 */
export function EmptyState({
  icon,
  message,
  actionLabel,
  onAction,
  testID,
}: EmptyStateProps) {
  const { colors, spacing } = useTheme();

  return (
    <View
      testID={testID}
      style={[s.container, { paddingVertical: spacing.xl, gap: spacing.sm }]}
    >
      <IconSymbol name={icon as never} size={48} color={colors.mutedLight} />
      <Text variant="subhead" tone="muted">
        {message}
      </Text>
      {actionLabel != null && onAction != null && (
        <Button
          variant="secondary"
          size="sm"
          label={actionLabel}
          onPress={onAction}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
});
