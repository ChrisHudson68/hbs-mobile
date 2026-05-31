import { useEffect, useRef, useState } from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { formatCurrency, formatHours } from '@/src/mobile/utils';

// [TUNABLE] count-up length (ms). Long enough to read the roll, short enough to
// feel responsive.
const COUNT_DURATION = 650;

type NumberFormat =
  | 'currency'
  | 'hours'
  | 'integer'
  | ((value: number) => string);

type AnimatedNumberProps = {
  value: number;
  /** 'currency' (formatCurrency) | 'hours' (formatHours) | 'integer' | custom fn. */
  format?: NumberFormat;
  duration?: number;
  style?: StyleProp<TextStyle>;
  testID?: string;
};

function formatValue(value: number, format: NumberFormat): string {
  if (typeof format === 'function') return format(value);
  if (format === 'hours') return formatHours(value);
  if (format === 'integer') return String(Math.round(value));
  return formatCurrency(value);
}

/**
 * Count-up number (Robinhood / Stripe "alive numbers"). Tweens on the JS thread
 * via requestAnimationFrame and renders a real <Text>, so it reuses the exact
 * formatCurrency / formatHours output and matches surrounding type styling.
 * Re-renders are throttled to frames where the formatted string actually
 * changes, and screen readers always announce the final value.
 *
 * @remarks One JS-thread rAF loop per instance. Do NOT render inside
 * FlatList / FlashList rows or large repeated grids — for many static numbers
 * render plain Text. Intended for hero / summary figures (screen open, refresh),
 * not per-frame / scroll-driven values.
 */
export function AnimatedNumber({
  value,
  format = 'currency',
  duration = COUNT_DURATION,
  style,
  testID,
}: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(() => formatValue(value, format));
  const numberRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const to = value;
    const from = numberRef.current;
    if (reduced || from === to) {
      numberRef.current = to;
      setDisplay(formatValue(to, format));
      return;
    }

    let startTs: number | null = null;
    let lastText = formatValue(from, format);
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const current = from + (to - from) * eased;
      numberRef.current = current;
      const next = formatValue(current, format);
      if (next !== lastText) {
        lastText = next; // throttle: only re-render on a visible change
        setDisplay(next);
      }
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        numberRef.current = to;
        const settled = formatValue(to, format);
        if (settled !== lastText) setDisplay(settled);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, reduced, format]);

  return (
    <Text style={style} testID={testID} accessibilityLabel={formatValue(value, format)}>
      {display}
    </Text>
  );
}
