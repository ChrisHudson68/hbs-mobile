import { Easing, EasingFunction } from 'react-native-reanimated';

type EasingName = 'decelerate' | 'standard' | 'accelerate';

// Maps the Motion token easing identifier strings (theme.ts) to Reanimated Easing
// objects. theme.ts is NOT imported from Reanimated — this utility is the bridge.
// Phase 1 UI-SPEC locked these mappings:
//   decelerate = Easing.out(Easing.quad)   — ease out (quick start, slow finish)
//   standard   = Easing.inOut(Easing.quad) — ease in-out (smooth mid-action)
//   accelerate = Easing.in(Easing.quad)    — ease in (slow start, fast finish)
const EASING_MAP: Record<EasingName, EasingFunction> = {
  decelerate: Easing.out(Easing.quad),
  standard: Easing.inOut(Easing.quad),
  accelerate: Easing.in(Easing.quad),
} as const;

export function motionEasing(name: EasingName): EasingFunction {
  return EASING_MAP[name];
}
