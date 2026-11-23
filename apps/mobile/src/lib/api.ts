import { createHttpApi, createMockApi, type VelaApi } from '@vela/api';
import { currentMockScenario, useDevStore } from '@/stores/dev';
import { authHeaders } from './auth';

const mock = createMockApi({ scenario: currentMockScenario });
const baseUrl = process.env.EXPO_PUBLIC_API_URL;
const http = baseUrl ? createHttpApi({ baseUrl, fallback: mock, currency: () => 'INR', headers: authHeaders }) : null;

function current(): VelaApi {
  if (!http) return mock;
  return useDevStore.getState().scenario === 'default' ? http : mock;
}

export const api: VelaApi = new Proxy({} as VelaApi, {
  get: (_target, key) => current()[key as keyof VelaApi],
});

export const usingLiveCatalog = Boolean(http);
