import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../../src/mobile/theme';

/**
 * Full-bleed blueprint backdrop for the Login screen (Phase 2 / 02-02).
 *
 * Recreates the locked sketch's `.screen` background (02-login-field-modes.html)
 * with three token-driven layers, bottom→top:
 *   1. a solid base fill (`colors.bg`),
 *   2. a wash gradient (`blueprintWashTop` → `blueprintWashBottom`) anchored
 *      top-right (the sketch's radial wash sits at 82% 0%; expo-linear-gradient
 *      is linear-only, so a near-diagonal linear gradient is a faithful stand-in),
 *   3. a subtle 34pt blueprint grid of hairlines in `colors.blueprintGrid`.
 *
 * All colors come from `useTheme()`, so it flips dark↔light automatically with
 * the system appearance. No raw hex. Children (the form) render ABOVE the layers.
 */

const GRID_CELL = 34;

export function LoginBackdrop({ children }: { children?: ReactNode }) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();

  // Hairline counts derived from the viewport; cheap repeated Views instead of
  // an SVG pattern (keeps the native dependency surface minimal — RESEARCH §7.5).
  const columnCount = Math.ceil(width / GRID_CELL);
  const rowCount = Math.ceil(height / GRID_CELL);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />

      <LinearGradient
        colors={[colors.blueprintWashTop, colors.blueprintWashBottom]}
        start={{ x: 0.82, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: columnCount }).map((_, i) => (
          <View
            key={`v${i}`}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: i * GRID_CELL,
              width: StyleSheet.hairlineWidth,
              backgroundColor: colors.blueprintGrid,
            }}
          />
        ))}
        {Array.from({ length: rowCount }).map((_, i) => (
          <View
            key={`h${i}`}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: i * GRID_CELL,
              height: StyleSheet.hairlineWidth,
              backgroundColor: colors.blueprintGrid,
            }}
          />
        ))}
      </View>

      {children}
    </View>
  );
}
