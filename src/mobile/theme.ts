import { createContext, useContext } from 'react';

export const Colors = {
  navy: '#1E3A5F',
  navyDark: '#0F1F35',
  yellow: '#F59E0B',
  yellowDark: '#D97706',
  bg: '#F0F2F7',
  card: '#FFFFFF',
  border: '#E2E8F2',
  text: '#0F172A',
  muted: '#64748B',
  mutedLight: '#94A3B8',
  success: '#16A34A',
  successBg: '#F0FDF4',
  successBorder: '#BBF7D0',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  warningBorder: '#FDE68A',
  infoBg: '#EFF6FF',
  infoBorder: '#BFDBFE',
  infoText: '#1D4ED8',
  // Additive (Phase 1) — new semantic keys; no existing key changed.
  cardElevated: '#FFFFFF',
  divider: '#E2E8F2',
  inverse: '#FFFFFF',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  // Additive (Phase 1) — hero areas, Login brand-top margin.
  xxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 18,
  // Additive (Phase 1) — badges, chips, full-round buttons.
  pill: 9999,
} as const;

export const Typography = {
  heading: { fontSize: 22, fontWeight: '800' as const, color: Colors.text, letterSpacing: -0.5 },
  subheading: { fontSize: 16, fontWeight: '700' as const, color: Colors.text },
  body: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  caption: { fontSize: 12, color: Colors.muted },
  label: { fontSize: 13, fontWeight: '600' as const, color: Colors.muted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
} as const;

// ---------------------------------------------------------------------------
// Phase 1 additive extensions — none of the above exports are modified.
// New consumers (components/ui/*) read tokens via useTheme(); legacy screens
// keep importing Colors/Spacing/Radius/Typography directly. Both coexist.
// ---------------------------------------------------------------------------

// iOS shadow presets. `elevation: 0` suppresses Android shadows (iOS-only milestone).
export const Elevation = {
  none: { shadowColor: '#000000', shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  sm: { shadowColor: '#000000', shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 0 },
  md: { shadowColor: '#000000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 0 },
  lg: { shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 0 },
} as const;

// Motion tokens — DEFINED in Phase 1, wired to components in Phase 6.
// `easing` holds an identifier string only; Reanimated Easing is NOT imported here.
export const Motion = {
  fast: { duration: 150, easing: 'decelerate' as const },
  base: { duration: 250, easing: 'standard' as const },
  slow: { duration: 400, easing: 'accelerate' as const },
} as const;

// iOS HIG type ramp — consumed by the <Text> kit component only (separate from
// legacy Typography). lineHeight is in pt (= Math.round(fontSize * HIG multiplier)).
// IOSTypeRamp.body is 17pt; legacy Typography.body stays 14pt — both coexist (D-02).
export const IOSTypeRamp = {
  largeTitle: { fontSize: 34, fontWeight: '700' as const, lineHeight: 41 },
  title1: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34 },
  title2: { fontSize: 22, fontWeight: '700' as const, lineHeight: 28 },
  title3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  headline: { fontSize: 17, fontWeight: '600' as const, lineHeight: 23 },
  body: { fontSize: 17, fontWeight: '400' as const, lineHeight: 25 },
  callout: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  subhead: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  footnote: { fontSize: 13, fontWeight: '400' as const, lineHeight: 19 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
} as const;

// Single stable module-level Theme object. Per D-03: declared at module scope,
// never created inside a hook/component, so React Compiler keeps it stable.
// Grouped shape supports a future dark-mode Provider without changing consumers.
export const Theme = {
  colors: Colors,
  spacing: Spacing,
  radius: Radius,
  typographyRamp: IOSTypeRamp,
  elevation: Elevation,
  motion: Motion,
} as const;

// Thin React Context reader. Default value = the module-level Theme const.
// No runtime theme-switching Provider in Phase 1 (the shape supports it later).
const ThemeContext = createContext<typeof Theme>(Theme);

export function useTheme() {
  return useContext(ThemeContext);
}
