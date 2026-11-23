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

export type PurchasedEsim = {
  iccid: string;
  smdp: string;
  activationCode: string;
  lpa: string;
  providerRef: string;
};

export type EsimUsage = {
  usedMb: number;
  totalMb: number;
  status: 'not_started' | 'active' | 'expired' | 'depleted';
  activatedAt: Date | null;
  expiresAt: Date | null;
};

export type UsageQuery = {
  iccid: string;
  providerRef: string;
  purchasedAt: Date;
  totalMb: number;
  validityDays: number;
};

export type EsimProvider = {
  name: string;
  listPlans(): Promise<ProviderPlan[]>;
  purchase(input: { planRef: string; idempotencyKey: string }): Promise<PurchasedEsim>;
  usage(query: UsageQuery): Promise<EsimUsage>;
};
