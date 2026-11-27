import type { Env } from '../../env';
import type { EsimProvider } from './provider';
import { createEsimAccess } from './esimaccess';
import { createEsimGo } from './esimgo';
import { createMockProvider } from './mock';

export function createEsimProvider(env: Pick<Env, 'ESIM_PROVIDER' | 'MOCK_USAGE_SPEED' | 'ESIM_ACCESS_CODE'>): EsimProvider {
  switch (env.ESIM_PROVIDER) {
    case 'esimaccess':
      return createEsimAccess({ accessCode: env.ESIM_ACCESS_CODE ?? '' });
    case 'mock':
      return createMockProvider({ usageSpeed: env.MOCK_USAGE_SPEED });
  }
}

export function createBackupProvider(env: Pick<Env, 'ESIM_BACKUP_PROVIDER' | 'ESIM_GO_API_KEY'>): EsimProvider | null {
  return env.ESIM_BACKUP_PROVIDER === 'esimgo' ? createEsimGo({ apiKey: env.ESIM_GO_API_KEY ?? '' }) : null;
}

export function providerFor(primary: EsimProvider, backup: EsimProvider | null | undefined, name: string): EsimProvider {
  return backup && name === backup.name ? backup : primary;
}
