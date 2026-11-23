import type { Env } from '../../../env';
import type { EsimProvider } from '../provider';
import { createMockProvider } from './mock';

export function createEsimProvider(env: Pick<Env, 'ESIM_PROVIDER' | 'MOCK_USAGE_SPEED'>): EsimProvider {
  switch (env.ESIM_PROVIDER) {
    case 'mock':
      return createMockProvider({ usageSpeed: env.MOCK_USAGE_SPEED });
  }
}
