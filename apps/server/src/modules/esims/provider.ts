import type { CurrencyCode } from '../../lib/money';

export type ProviderPlan = {
  ref: string;
  type: 'country' | 'regional' | 'global';
  regionRef: string | null;
  countryCodes: string[];
  dataMb: number;
  validityDays: number;
  is5g: boolean;
  hotspot: boolean;
  networks: string[];
  activation: 'on_install' | 'on_first_connection';
  cost: { amountMinor: number; currency: CurrencyCode };
  suggestedRetail: { amountMinor: number; currency: CurrencyCode }[];
};

export type EsimProvider = {
  name: string;
  listPlans(): Promise<ProviderPlan[]>;
};
