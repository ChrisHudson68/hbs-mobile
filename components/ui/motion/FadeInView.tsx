import {
  FadeInContent,
  type FadeInContentProps,
} from '@/components/ui/motion/FadeInContent';

// Derived from FadeInContent so the prop surface can't drift.
type FadeInViewProps = Omit<FadeInContentProps, 'visible'>;

/**
 * Fades + lifts content in on mount. Convenience wrapper over FadeInContent for
 * always-present content; for loading-gated content use FadeInContent with the
 * `visible` prop instead.
 */
export function FadeInView(props: FadeInViewProps) {
  return <FadeInContent visible {...props} />;
}
