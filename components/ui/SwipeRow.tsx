import { ReactNode, useRef } from 'react';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import type { SharedValue } from 'react-native-reanimated';

// LOCKED shared thresholds — all Wave-2 swipe surfaces use these constants so
// gesture behavior is identical across timesheets, invoices, and job-detail rows.
// Changing these here changes the feel everywhere at once.
const SWIPE_FRICTION = 2;
const SWIPE_RIGHT_THRESHOLD = 64;
const SWIPE_OVERSHOOT_FRICTION = 8;

type SwipeRowProps = {
  children: ReactNode;
  /**
   * Render the right-action panel. Receives the `drag` SharedValue (negative
   * for left-swipe = right-actions revealed — see 06-RESEARCH Pitfall 3) and
   * the row's SwipeableMethods for imperative close/open control.
   *
   * Action helpers should interpolate drag.get() over a negative domain:
   *   interpolate(drag.get(), [-panelWidth, 0], [0, panelWidth], Extrapolation.CLAMP)
   */
  renderActions: (
    drag: SharedValue<number>,
    methods: SwipeableMethods,
  ) => ReactNode;
  testID?: string;
  /**
   * When false, renders children with NO swipe wrapper — used to disable swipe
   * on rows that should not support it (e.g. employee rows, non-manager rows).
   * Defaults to true.
   */
  enabled?: boolean;
};

// Module-level mutable ref: tracks the currently-open SwipeRow's methods so
// we can close any previously-open row when a new one opens (one-open-at-a-time).
// Module scope is safe here because the open state is global to the screen.
let openRowRef: SwipeableMethods | null = null;

/**
 * Close any currently-open SwipeRow. Call from a parent ScrollView's
 * `onScrollBeginDrag` to implement close-on-scroll (06-RESEARCH Pitfall 5).
 *
 * @example
 * <ScrollView onScrollBeginDrag={closeOpenSwipeRow}>
 *   {items.map(item => <SwipeRow .../>)}
 * </ScrollView>
 */
export function closeOpenSwipeRow(): void {
  openRowRef?.close();
}

/**
 * Shared swipe-to-reveal wrapper built on ReanimatedSwipeable. Enforces
 * one-open-at-a-time, close-on-scroll (via closeOpenSwipeRow), and the locked
 * shared thresholds (friction=2, rightThreshold=64, overshootFriction=8) so
 * all Wave-2 swipe surfaces (timesheets week list, invoices list, job-detail
 * expense + time rows) have identical gesture behavior.
 *
 * Pass `enabled={false}` to bypass the swipe wrapper entirely — useful for
 * role-gating (e.g. employee rows, !canManage rows).
 *
 * Gesture-conflict note (06-RESEARCH Pitfall 5): the default
 * `dragOffsetFromRightEdge=10` means the swipe only activates after 10px of
 * horizontal travel, which satisfies legacy ScrollView priority. Additionally,
 * close-on-scroll (closeOpenSwipeRow in onScrollBeginDrag) prevents an open
 * panel blocking vertical scroll.
 */
export function SwipeRow({
  children,
  renderActions,
  testID,
  enabled = true,
}: SwipeRowProps) {
  // Per-row ref to this row's SwipeableMethods — used for one-open-at-a-time.
  const thisRowRef = useRef<SwipeableMethods | null>(null);

  if (!enabled) {
    return <>{children}</>;
  }

  function handleWillOpen() {
    // Close any other open row before this one opens.
    if (openRowRef !== null && openRowRef !== thisRowRef.current) {
      openRowRef.close();
    }
    openRowRef = thisRowRef.current;
  }

  function handleClose() {
    // Clear the module-level ref when this row closes so closeOpenSwipeRow
    // does not try to close an already-closed row.
    if (openRowRef === thisRowRef.current) {
      openRowRef = null;
    }
  }

  return (
    <ReanimatedSwipeable
      ref={thisRowRef}
      friction={SWIPE_FRICTION}
      rightThreshold={SWIPE_RIGHT_THRESHOLD}
      overshootFriction={SWIPE_OVERSHOOT_FRICTION}
      renderRightActions={(_progress, drag, methods) =>
        renderActions(drag, methods)
      }
      onSwipeableWillOpen={handleWillOpen}
      onSwipeableClose={handleClose}
      testID={testID}
    >
      {children}
    </ReanimatedSwipeable>
  );
}
