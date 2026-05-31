import * as Haptics from 'expo-haptics';

// Central haptic vocabulary (Premium-Feel W0). Semantic names → expo-haptics
// primitives, one place. All fire-and-forget (void) so they never block the UI.
// Rules: selection on tap / nav, light impact on toggle / pull-to-refresh,
// success / error / warning notification on a submit outcome.

export const ImpactStyle = Haptics.ImpactFeedbackStyle;

export function hapticSelection() {
  void Haptics.selectionAsync();
}

export function hapticImpact(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light,
) {
  void Haptics.impactAsync(style);
}

export function hapticSuccess() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function hapticError() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

export function hapticWarning() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}
