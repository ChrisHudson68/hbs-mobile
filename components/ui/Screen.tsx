import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../../src/mobile/theme';

type ScreenBackground = 'bg' | 'card';

/**
 * Header reconciliation mode:
 * - `'none'` (default): today's behavior — SafeAreaView applies the top edge.
 * - `'native'`: a native-stack header owns the top inset, so the top edge is
 *   dropped and the ScrollView uses `contentInsetAdjustmentBehavior="automatic"`
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
  /** Adds a KeyboardAvoidingView (iOS `padding` behavior). */
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

  const inner = scroll ? (
    <ScrollView
      style={s.flex}
      contentContainerStyle={contentPadding}
      keyboardShouldPersistTaps="handled"
      {...(isNativeHeader ? { contentInsetAdjustmentBehavior: 'automatic' as const } : {})}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[s.flex, contentPadding]}>{children}</View>
  );

  const body = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {inner}
    </KeyboardAvoidingView>
  ) : (
    inner
  );

  return (
    <SafeAreaView edges={edges} style={[s.flex, { backgroundColor }]} testID={testID}>
      {body}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
});
