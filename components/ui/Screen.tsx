import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../src/mobile/theme';

type ScreenBackground = 'bg' | 'card';

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
  testID?: string;
};

/**
 * SafeArea + optional scroll/keyboard layout wrapper. Reads tokens via useTheme().
 * SafeAreaView edges are ['top'] only — the bottom edge is managed per-screen
 * (tab-bar vs stack-screen contexts differ). Screens own their own loading/empty
 * states; this wrapper does not embed them.
 */
export function Screen({
  children,
  padded = true,
  scroll = false,
  keyboardAvoiding = false,
  background = 'bg',
  testID,
}: ScreenProps) {
  const { colors, spacing } = useTheme();

  const backgroundColor = background === 'card' ? colors.card : colors.bg;
  const contentPadding = padded ? { paddingHorizontal: spacing.md } : null;

  const inner = scroll ? (
    <ScrollView
      style={s.flex}
      contentContainerStyle={contentPadding}
      keyboardShouldPersistTaps="handled"
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
    <SafeAreaView edges={['top']} style={[s.flex, { backgroundColor }]} testID={testID}>
      {body}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
});
