import { Pressable } from 'react-native';
import type { SymbolViewProps } from 'expo-symbols';
import { IconSymbol } from './icon-symbol';

/**
 * Standard navigation-header icon button (e.g. the "+" new-item action).
 *
 * Wraps the glyph in a 44pt-WIDE centered box so react-native-screens hands iOS a
 * symmetric horizontal content box; iOS 26 then draws its Liquid Glass bar-button
 * capsule centered on it, keeping the glyph horizontally centered (a bare icon view
 * let it drift ~7pt leading). Height is left intrinsic on purpose: forcing a 44pt
 * height makes RN geometrically center the glyph, which lands ~4pt low because
 * UIKit normally optically-centers SF Symbols. Letting iOS place the short button
 * vertically preserves that optical centering. hitSlop restores the 44pt tap target.
 */
export function HeaderIconButton({
  name,
  color,
  onPress,
  accessibilityLabel,
  testID,
  size = 22,
}: {
  name: SymbolViewProps['name'];
  color: string;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      hitSlop={{ top: 11, bottom: 11, left: 8, right: 8 }}
      style={{ width: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <IconSymbol name={name} size={size} color={color} />
    </Pressable>
  );
}
