import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { DarkTheme, LightTheme, ThemeContext } from '../theme';

/**
 * System-appearance ThemeProvider (Phase 2 / 02-01).
 *
 * Reads the OS appearance via React Native's `useColorScheme()` (which auto-
 * subscribes to system changes and re-renders on flip) and SELECTS one of two
 * pre-built, module-scope theme constants. It never constructs a new theme
 * object per render, so React Compiler (experiments.reactCompiler: true) keeps
 * the provider value referentially stable per scheme — so no reflexive
 * memoization hook is added (repo rule).
 *
 * A `null`/`undefined` scheme is treated as light (only `'dark'` flips).
 *
 * Both themes satisfy the shared `ThemeValue` type (identical key shape,
 * differing only in color literals), so the ternary needs no cast.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const value = scheme === 'dark' ? DarkTheme : LightTheme;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
