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
  /**
   * When true, the sheet auto-sizes to its content height (no fixed detent).
   * Use for short, static content (e.g. a help/confirm sheet) so the panel hugs
   * its content instead of leaving empty space below. Ignores `snapPoints` and
   * forces the non-scroll BottomSheetView (dynamic sizing measures its content).
   */
  fitContent?: boolean;
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
  fitContent = false,
  children,
  testID,
}: SheetProps) {
  const { colors, spacing } = useTheme();

  // Content-hugging mode: gorhom sizes the panel to its content. Omit the
  // percentage snapPoints (they would fight dynamic sizing) and use the
  // measurable BottomSheetView rather than a scroll view.
  const dynamic = fitContent === true;
  const useScroll = scrollable && !dynamic;
  const resolvedSnapPoints = dynamic ? undefined : snapPoints;

  // Comfortable horizontal gutters for all sheet content (token-driven).
  const contentPadding = { paddingHorizontal: spacing.lg };

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
      snapPoints={resolvedSnapPoints}
      onChange={handleChange}
      enablePanDownToClose
      enableDynamicSizing={dynamic}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{
        width: DRAG_INDICATOR_WIDTH,
        height: DRAG_INDICATOR_HEIGHT,
        backgroundColor: colors.border,
      }}
    >
      {useScroll ? (
        <BottomSheetScrollView testID={testID} contentContainerStyle={[s.scrollContent, contentPadding]}>
          {headerNode}
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView testID={testID} style={[dynamic ? null : s.viewContent, contentPadding]}>
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
