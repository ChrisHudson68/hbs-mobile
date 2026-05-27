import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';

import { useTheme } from '../../src/mobile/theme';

export type SheetProps = {
  /** Required — fires when the sheet dismisses (onChange index -1). */
  onClose: () => void;
  snapPoints?: (string | number)[];
  initialIndex?: number;
  /** Optional content rendered above the children. */
  header?: ReactNode;
  /** When true, content scrolls via BottomSheetScrollView; else BottomSheetView. */
  scrollable?: boolean;
  children: ReactNode;
  testID?: string;
};

// HIG drag-indicator dimensions (pt) — the documented hardcode exception
// (UI-SPEC "Spacing Scale" exceptions); not design tokens.
const DRAG_INDICATOR_WIDTH = 36;
const DRAG_INDICATOR_HEIGHT = 4;

const BACKDROP_OPACITY = 0.5;
const DEFAULT_SNAP_POINTS = ['50%', '90%'];

/**
 * Token-styled wrapper over @gorhom/bottom-sheet (5.2.14). Requires the app-root
 * GestureHandlerRootView (wired in plan 01-02) to drag. `onClose` fires when the
 * sheet dismisses (onChange index -1). No Reanimated shared value is read here
 * (React Compiler safe — uses get()/set() conventions only if ever added).
 * `enableDynamicSizing` is disabled so the explicit snapPoints govern height
 * (gorhom v5 default would otherwise auto-size and fight percentage detents).
 */
export function Sheet({
  onClose,
  snapPoints = DEFAULT_SNAP_POINTS,
  initialIndex = 0,
  header,
  scrollable = false,
  children,
  testID,
}: SheetProps) {
  const { colors } = useTheme();

  function handleChange(index: number) {
    if (index === -1) {
      onClose();
    }
  }

  function renderBackdrop(props: BottomSheetBackdropProps) {
    return (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={BACKDROP_OPACITY}
        style={[props.style, { backgroundColor: colors.text }]}
      />
    );
  }

  const headerNode = header ? <View style={s.header}>{header}</View> : null;

  return (
    <BottomSheet
      index={initialIndex}
      snapPoints={snapPoints}
      onChange={handleChange}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{
        width: DRAG_INDICATOR_WIDTH,
        height: DRAG_INDICATOR_HEIGHT,
        backgroundColor: colors.border,
      }}
    >
      {scrollable ? (
        <BottomSheetScrollView testID={testID} contentContainerStyle={s.scrollContent}>
          {headerNode}
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView testID={testID} style={s.viewContent}>
          {headerNode}
          {children}
        </BottomSheetView>
      )}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  viewContent: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {},
});
