import type { MockScenario } from '@vela/api';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

export type DevScenario = MockScenario | 'offline';

export const devScenarios: readonly DevScenario[] = ['default', 'loading', 'empty', 'error', 'offline', 'lowData', 'expired'];

type DevState = {
  scenario: DevScenario;
  setScenario: (scenario: DevScenario) => void;
};

export const useDevStore = create<DevState>()(
  persist(
    (set) => ({
      scenario: 'default',
      setScenario: (scenario) => set({ scenario: __DEV__ ? scenario : 'default' }),
    }),
    { name: 'vela-dev', storage: persistStorage },
  ),
);

export function currentMockScenario(): MockScenario {
  const scenario = useDevStore.getState().scenario;
  return scenario === 'offline' ? 'default' : scenario;
}
