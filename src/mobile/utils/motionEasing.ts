import { Easing, EasingFunction } from 'react-native-reanimated';

type EasingName = 'decelerate' | 'standard' | 'accelerate';

// Maps the Motion token easing identifier strings (theme.ts) to Reanimated Easing
// functions. theme.ts is NOT imported from Reanimated — this utility is the bridge.
//
// Premium-Feel W0: the Phase-1 quad curves were too weak (no punch). Replaced
// with Emil Kowalski's strong custom cubic-beziers so motion reads as
// intentional. `bezierFn` returns a raw (t)=>number worklet = EasingFunction,
// so the map type and motionEasing() signature stay unchanged.
//   decelerate = ease-out     cubic-bezier(0.23, 1, 0.32, 1)   — entering/exiting; quick start, soft finish
//   standard   = ease-in-out  cubic-bezier(0.77, 0, 0.175, 1)  — on-screen movement / morph
//   accelerate = ease-in      cubic-bezier(0.5, 0, 0.75, 0)    — rare morph-away (exits generally prefer decelerate)
const EASING_MAP: Record<EasingName, EasingFunction> = {
  decelerate: Easing.bezierFn(0.23, 1, 0.32, 1),
  standard: Easing.bezierFn(0.77, 0, 0.175, 1),
  accelerate: Easing.bezierFn(0.5, 0, 0.75, 0),
} as const;

export function motionEasing(name: EasingName): EasingFunction {
  return EASING_MAP[name];
}
