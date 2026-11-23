import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type TripState = {
  usedMB: number;
  totalMB: number;
  expiresAt: number | null;
  status: string;
  leftLabel: string;
  statusLabel: string;
};

export type TripStart = {
  iccid: string;
  label: string;
  flag: string;
  state: TripState;
};

export type PushTokenEvent = { iccid: string; token: string };

type NativeModule = {
  addListener(event: 'onPushToken', listener: (event: PushTokenEvent) => void): { remove(): void };
  isSupported(): boolean;
  list(): { id: string; iccid: string }[];
  start(input: TripStart): Promise<string>;
  update(iccid: string, state: TripState): Promise<void>;
  end(iccid: string): Promise<void>;
};

const native = Platform.OS === 'ios' ? requireOptionalNativeModule<NativeModule>('VelaLiveActivity') : null;

export const liveActivity = {
  isSupported: (): boolean => {
    try {
      return native?.isSupported() ?? false;
    } catch {
      return false;
    }
  },
  trackedIccids: (): string[] => {
    try {
      return native?.list().map((item) => item.iccid) ?? [];
    } catch {
      return [];
    }
  },
  start: async (input: TripStart) => native?.start(input),
  update: async (iccid: string, state: TripState) => native?.update(iccid, state),
  end: async (iccid: string) => native?.end(iccid),
  onPushToken: (listener: (event: PushTokenEvent) => void): (() => void) => {
    const subscription = native?.addListener('onPushToken', listener);
    return () => subscription?.remove();
  },
};
