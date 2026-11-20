import * as Haptics from 'expo-haptics';

function fire(run: () => Promise<void>) {
  run().catch(() => undefined);
}

export const haptics = {
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  press: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  selection: () => fire(() => Haptics.selectionAsync()),
  tick: () => fire(() => Haptics.selectionAsync()),
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
} as const;

export type HapticKind = keyof typeof haptics;

export function triggerHaptic(kind: HapticKind | false | undefined) {
  if (kind) haptics[kind]();
}
