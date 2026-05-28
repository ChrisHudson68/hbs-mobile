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
  // Additive (Phase 2 / 02-01) — Login blueprint backdrop tokens (light skin).
  // grid hairline, radial-wash endpoints. Dark siblings live in DarkColors.
  blueprintGrid: 'rgba(30,58,95,0.05)',
  blueprintWashTop: '#FFFFFF',
  blueprintWashBottom: '#E4E9F2',
} as const;

// ---------------------------------------------------------------------------
// Phase 2 (02-01) additive — DARK palette. A full sibling of `Colors` with the
// IDENTICAL key set, dark-appropriate values pulled from the locked sketch
// (.planning/sketches/02-login-field-modes.html `.dark` block) + RESEARCH §2a.
// Brand identity (yellow / yellowDark) is intentionally stable across skins.
// `Colors` is unchanged and remains the LIGHT palette.
// ---------------------------------------------------------------------------
export const DarkColors = {
  navy: '#6E92C6',
  navyDark: '#4A6FA0',
  yellow: '#F59E0B',
  yellowDark: '#D97706',
  bg: '#0F2138',
  card: '#16294A',
  border: '#314E78',
  text: '#FFFFFF',
  muted: '#6E87AB',
  mutedLight: '#5A6E8F',
  success: '#4ADE80',
  successBg: '#16301F',
  successBorder: '#2F5A3E',
  danger: '#FF7A7A',
  dangerBg: '#3A1F26',
  dangerBorder: '#6E3B42',
  warning: '#FBBF24',
  warningBg: '#33270D',
  warningBorder: '#5C461A',
  infoBg: '#16294A',
  infoBorder: '#314E78',
  infoText: '#8DB0E0',
  cardElevated: '#1C355C',
  divider: '#314E78',
  inverse: '#0F172A',
  blueprintGrid: 'rgba(255,255,255,0.034)',
  blueprintWashTop: '#24477A',
  blueprintWashBottom: '#081120',
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

// Two stable module-level theme objects (Phase 2 / 02-01). Per D-03: declared at
// module scope, never created inside a hook/component, so React Compiler keeps
// them referentially stable. The ThemeProvider (02-02 wiring) SELECTS one of
// these by OS appearance — it never builds a new theme object per render.
// spacing / radius / typographyRamp / elevation / motion are appearance-
// independent and reused across both skins.
export const LightTheme = {
  colors: Colors,
  spacing: Spacing,
  radius: Radius,
  typographyRamp: IOSTypeRamp,
  elevation: Elevation,
  motion: Motion,
} as const;

export const DarkTheme = {
  colors: DarkColors,
  spacing: Spacing,
  radius: Radius,
  typographyRamp: IOSTypeRamp,
  elevation: Elevation,
  motion: Motion,
} as const;

// `Theme` stays exported as an alias of `LightTheme` so any existing importer
// (Phase 1 consumers) keeps working byte-for-byte — additive, no break.
export const Theme = LightTheme;

// Thin React Context reader. Default value = LightTheme (so consumers rendered
// OUTSIDE the provider still resolve to a valid theme, preserving the Phase 1
// useTheme() contract). The provider supplies the appearance-selected value.
// Exported so the ThemeProvider can be the single source of truth (02-01-2).
export const ThemeContext = createContext<typeof LightTheme>(LightTheme);

export function useTheme() {
  return useContext(ThemeContext);
}
