import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardToolbar,
} from 'react-native-keyboard-controller';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Colors, DarkColors, useTheme } from '../../src/mobile/theme';

type ScreenBackground = 'bg' | 'card';

// [TUNABLE] gap kept between the focused field's caret and the keyboard top.
const KEYBOARD_BOTTOM_OFFSET = 24;

/**
 * Header reconciliation mode:
 * - `'none'` (default): today's behavior — SafeAreaView applies the top edge.
 * - `'native'`: a native-stack header owns the top inset, so the top edge is
 *   dropped and the scroll view uses `contentInsetAdjustmentBehavior="automatic"`
 *   for glitch-free large-title collapse (react-native-screens #2822/#2871).
 *   Opt-in for Phase-4/5 native-header screens; inert until a screen sets it.
 */
type ScreenHeaderMode = 'none' | 'native';

type ScreenProps = {
  children: ReactNode;
  /** Applies horizontal Spacing.md padding. */
  padded?: boolean;
  /** Wraps children in a ScrollView. */
  scroll?: boolean;
  /**
   * Keyboard-aware scroll container: the content glides in sync with the
   * keyboard (react-native-keyboard-controller) and a Done/Prev/Next toolbar is
   * shown above keyboards with no return key (decimal-pad money/hours fields).
   * Implies a scroll container. A Done/Prev/Next toolbar (KeyboardToolbar) is
   * shown above the keyboard so decimal-pad fields (no return key) can be
   * dismissed and adjacent fields navigated via the up/down arrows.
   */
  keyboardAvoiding?: boolean;
  /** Surface fill — maps to colors.bg / colors.card. */
  background?: ScreenBackground;
  /** Native-header reconciliation. Default `'none'` = unchanged behavior. */
  headerMode?: ScreenHeaderMode;
  testID?: string;
};

/**
 * SafeArea + optional scroll/keyboard layout wrapper. Reads tokens via useTheme().
 * By default SafeAreaView edges are ['top'] only — the bottom edge is managed
 * per-screen (tab-bar vs stack-screen contexts differ). Under a native header
 * (`headerMode="native"`) the top edge is dropped so the header owns the inset.
 * Screens own their own loading/empty states; this wrapper does not embed them.
 */
export function Screen({
  children,
  padded = true,
  scroll = false,
  keyboardAvoiding = false,
  background = 'bg',
  headerMode = 'none',
  testID,
}: ScreenProps) {
  const { colors, spacing } = useTheme();

  const backgroundColor = background === 'card' ? colors.card : colors.bg;
  const contentPadding = padded ? { paddingHorizontal: spacing.md } : null;

  // Native header owns the top inset; otherwise SafeAreaView applies it (default).
  const isNativeHeader = headerMode === 'native';
  const edges: Edge[] = isNativeHeader ? ['left', 'right'] : ['top'];

  // keyboardAvoiding → a single KeyboardAwareScrollView that reads the live
  // keyboard frame off the UI thread and glides the focused field into view.
  // Replaces the old KeyboardAvoidingView(padding) + ScrollView
  // automaticallyAdjustKeyboardInsets combo, which double-adjusted and left
  // fields clipped behind the keyboard inside formSheets. The KeyboardToolbar
  // floats a Done/Prev/Next bar above keyboards (the decimal-pad fields have no
  // return key). Lives under the app-root <KeyboardProvider> (app/_layout.tsx).
  if (keyboardAvoiding) {
    return (
      <SafeAreaView edges={edges} style={[s.flex, { backgroundColor }]} testID={testID}>
        <KeyboardAwareScrollView
          style={s.flex}
          contentContainerStyle={[s.scrollContent, contentPadding]}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior={isNativeHeader ? 'automatic' : 'never'}
          bottomOffset={KEYBOARD_BOTTOM_OFFSET}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </KeyboardAwareScrollView>
        <KeyboardToolbar theme={KEYBOARD_TOOLBAR_THEME} />
      </SafeAreaView>
    );
  }

  const inner = scroll ? (
    <ScrollView
      style={s.flex}
      contentContainerStyle={[s.scrollContent, contentPadding]}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior={isNativeHeader ? 'automatic' : 'never'}
      automaticallyAdjustKeyboardInsets
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[s.flex, contentPadding]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={[s.flex, { backgroundColor }]} testID={testID}>
      {inner}
    </SafeAreaView>
  );
}

// Brand-tint the keyboard accessory toolbar (Done + prev/next chevrons). The
// library default `primary` is iOS system-blue (#007AFF) — explicitly off-brand.
// Module-scope constant: stable identity, never rebuilt per render. Both skins
// are supplied (the toolbar picks by OS appearance independent of useTheme()).
const KEYBOARD_TOOLBAR_THEME = {
  light: {
    primary: Colors.navy,
    disabled: Colors.mutedLight,
    background: Colors.card,
    ripple: 'rgba(30,58,95,0.12)',
  },
  dark: {
    primary: DarkColors.navy,
    disabled: DarkColors.mutedLight,
    background: DarkColors.card,
    ripple: 'rgba(110,146,198,0.18)',
  },
} as const;

const s = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
});
