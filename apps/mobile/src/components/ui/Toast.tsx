import { durations } from '@vela/tokens';
import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, useReducedMotion } from 'react-native-reanimated';
import { FullWindowOverlay } from 'react-native-screens';
import { create } from 'zustand';
import { haptics } from '@/lib/haptics';
import type { IconName } from '@/lib/icons';
import { reducedFadeIn, reducedFadeOut, velaEasing } from '@/lib/motion';
import { Icon } from './Icon';
import { Text } from './Text';
import type { Tone } from './tone';

export type ToastTone = 'neutral' | 'success' | 'warning' | 'danger';

export type ToastInput = {
  message: string;
  tone?: ToastTone;
  icon?: IconName;
  duration?: number;
};

type ActiveToast = ToastInput & { id: number };

type ToastState = {
  current: ActiveToast | null;
  show: (input: ToastInput) => void;
  hide: (id: number) => void;
};

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  current: null,
  show: (input) => set({ current: { ...input, id: nextId++ } }),
  hide: (id) => set((state) => (state.current?.id === id ? { current: null } : state)),
}));

export const toast = {
  show: (input: ToastInput) => useToastStore.getState().show(input),
};

const iconByTone: Record<ToastTone, IconName> = {
  neutral: 'info',
  success: 'checkCircle',
  warning: 'warning',
  danger: 'error',
};

const iconTone: Record<ToastTone, Tone> = {
  neutral: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

const hapticByTone: Record<ToastTone, () => void> = {
  neutral: haptics.tap,
  success: haptics.success,
  warning: haptics.warning,
  danger: haptics.error,
};

function Overlay({ children }: { children: ReactNode }) {
  if (Platform.OS === 'ios') return <FullWindowOverlay>{children}</FullWindowOverlay>;
  return <>{children}</>;
}

export function ToastViewport() {
  const current = useToastStore((state) => state.current);
  const hide = useToastStore((state) => state.hide);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!current) return;
    const tone = current.tone ?? 'neutral';
    hapticByTone[tone]();
    AccessibilityInfo.announceForAccessibility(current.message);
    const timer = setTimeout(() => hide(current.id), current.duration ?? durations.toast);
    return () => clearTimeout(timer);
  }, [current, hide]);

  const tone = current?.tone ?? 'neutral';

  return (
    <Overlay>
      <View className="pointer-events-box-none absolute inset-x-0 top-0 items-center px-gutter pt-safe">
        {current ? (
          <Animated.View
            key={current.id}
            entering={reduceMotion ? reducedFadeIn : FadeInUp.duration(durations.base).easing(velaEasing)}
            exiting={reduceMotion ? reducedFadeOut : FadeOutUp.duration(durations.fast)}
            className="mt-2 flex-row items-center gap-2 rounded-pill border border-line border-t-line-highlight bg-surface-3 px-4 py-2.5"
          >
            <Icon name={current.icon ?? iconByTone[tone]} size={15} tone={iconTone[tone]} />
            <Text variant="callout" weight="medium" numberOfLines={2}>
              {current.message}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </Overlay>
  );
}
