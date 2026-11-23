import type { Env } from '../../../env';
import type { EsimProvider } from '../provider';
import { createEsimAccess } from './esimaccess';
import { createMockProvider } from './mock';

export function createEsimProvider(env: Pick<Env, 'ESIM_PROVIDER' | 'MOCK_USAGE_SPEED' | 'ESIM_ACCESS_CODE'>): EsimProvider {
  switch (env.ESIM_PROVIDER) {
    case 'esimaccess':
      return createEsimAccess({ accessCode: env.ESIM_ACCESS_CODE ?? '' });
    case 'mock':
      return createMockProvider({ usageSpeed: env.MOCK_USAGE_SPEED });
  }
}
