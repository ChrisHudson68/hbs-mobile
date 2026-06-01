import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import RNErrorBoundary from 'react-native-error-boundary';
import type { ErrorBoundaryProps } from 'expo-router';

import { Colors, Radius, Spacing } from '../../src/mobile/theme';

/**
 * App-wide crash recovery (Premium-Feel / bulletproof hardening, Sentry-free).
 *
 * Wraps the whole app below GestureHandlerRootView so a render/lifecycle throw in
 * ANY screen or provider shows a branded "Something went wrong — Retry" screen
 * instead of a white screen, and `resetError` re-mounts the subtree. Catches
 * render + lifecycle errors only (NOT event-handler/async errors — keep per-screen
 * try/catch for those).
 *
 * The fallback reads STATIC light tokens (Colors/Spacing/Radius), never useTheme(),
 * because it may render when ThemeProvider itself has crashed (it sits ABOVE the
 * providers). `onError` is the single observability hook-point: today it logs
 * locally; a crash reporter (or a backend error sink) can be wired here later
 * without changing any screen.
 */

export type ErrorFallbackProps = {
  error: Error;
  onRetry: () => void;
  title?: string;
  subtitle?: string;
};

/** Shared branded fallback UI — reused by the root boundary and per-route boundaries. */
export function ErrorFallbackView({ error, onRetry, title, subtitle }: ErrorFallbackProps) {
  return (
    <View style={s.container} accessibilityRole="alert">
      <View style={s.badge}>
        <Text style={s.badgeMark}>!</Text>
      </View>
      <Text style={s.title}>{title ?? 'Something went wrong'}</Text>
      <Text style={s.subtitle}>
        {subtitle ?? 'The app hit an unexpected error. Tap retry to continue — your data is safe.'}
      </Text>
      {__DEV__ ? <Text style={s.devDetail}>{String(error?.message ?? error)}</Text> : null}
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [s.cta, pressed && s.ctaPressed]}
        accessibilityRole="button"
        accessibilityLabel="Retry"
      >
        <Text style={s.ctaLabel}>Retry</Text>
      </Pressable>
    </View>
  );
}

function logAppError(error: Error, stackTrace: string) {
  // Single observability hook-point (no Sentry). Wire a crash reporter / backend
  // error sink here later without touching any screen. Never log auth tokens or GPS.
  console.error('[AppErrorBoundary]', error?.message, '\n', stackTrace);
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <RNErrorBoundary
      onError={logAppError}
      FallbackComponent={({ error, resetError }) => (
        <ErrorFallbackView error={error} onRetry={resetError} />
      )}
    >
      {children}
    </RNErrorBoundary>
  );
}

/**
 * Per-route crash boundary for Expo Router. Re-export as `ErrorBoundary` from any
 * data-fetching screen file (`export { RouteErrorBoundary as ErrorBoundary } from ...`)
 * and Expo Router scopes a thrown render error to THAT route — the tab bar / nav
 * chrome survive and `retry` re-renders just the screen. Do NOT navigate (router.replace)
 * from here; `retry` is the recovery path (react19-domain.md).
 */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <ErrorFallbackView
      error={error}
      onRetry={retry}
      title="Couldn't load this screen"
      subtitle="We hit a snag loading this. Tap retry — your data is safe."
    />
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.bg,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.navy,
    marginBottom: Spacing.lg,
  },
  badgeMark: { color: Colors.inverse, fontSize: 34, fontWeight: '800' },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.navy,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    color: Colors.muted,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  devDetail: {
    fontSize: 12,
    color: Colors.danger,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    fontFamily: 'Courier',
  },
  cta: {
    minHeight: 52,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    backgroundColor: Colors.yellow,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  ctaPressed: { opacity: 0.85 },
  ctaLabel: { fontSize: 17, fontWeight: '700', color: Colors.text },
});
