import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../src/mobile/theme';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';

// Mirrors ListRow layout constants (LIST_ROW_MIN_HEIGHT=56, spacing.md gap/padding).
const SKELETON_ROW_MIN_HEIGHT = 56;
const LEADING_CIRCLE_SIZE = 36;

/**
 * ListRow-shaped skeleton placeholder (leading circle + 2 text lines).
 * Mirrors ListRow padding/gap/minHeight so the skeleton→content transition
 * is visually seamless. Composes SkeletonBlock — no animation logic of its own.
 */
export function SkeletonRow({ testID }: { testID?: string }) {
  const { spacing } = useTheme();

  return (
    <View
      testID={testID}
      style={[
        s.row,
        {
          minHeight: SKELETON_ROW_MIN_HEIGHT,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          gap: spacing.md,
        },
      ]}
    >
      {/* Leading circle — mirrors ListRow's ICON_SIZE container */}
      <SkeletonBlock
        width={LEADING_CIRCLE_SIZE}
        height={LEADING_CIRCLE_SIZE}
        borderRadius={LEADING_CIRCLE_SIZE / 2}
      />

      {/* Body: title + subtitle lines */}
      <View style={s.body}>
        <SkeletonBlock width="60%" height={14} />
        <SkeletonBlock width="40%" height={11} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    gap: 6,
  },
});
