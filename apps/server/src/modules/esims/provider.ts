import type { CurrencyCode } from '../../lib/money';

export type ProviderPlan = {
  ref: string;
  type: 'country' | 'regional' | 'global';
  regionRef: string | null;
  regionName?: string;
  countryCodes: string[];
  dataMb: number;
  validityDays: number;
  is5g: boolean;
  hotspot: boolean;
  networks: string[];
  activation: 'on_install' | 'on_first_connection';
  cost: { amountMinor: number; currency: CurrencyCode };
  suggestedRetail: { amountMinor: number; currency: CurrencyCode }[];
  topUps: ProviderTopUp[];
};

export type ProviderTopUp = {
  ref: string;
  dataMb: number;
  extraDays: number;
  cost: { amountMinor: number; currency: CurrencyCode };
  suggestedRetail: { amountMinor: number; currency: CurrencyCode }[];
};

export class ProviderUnavailable extends Error {
  constructor(
    readonly provider: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderUnavailable';
  }
}

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
  planMb: number;
  totalMb: number;
  validityDays: number;
  extraDays: number;
};

export type EsimProvider = {
  name: string;
  listPlans(): Promise<ProviderPlan[]>;
  purchase(input: { planRef: string; idempotencyKey: string }): Promise<PurchasedEsim>;
  usage(query: UsageQuery): Promise<EsimUsage>;
  topUp(input: { iccid: string; providerRef: string; packRef: string; idempotencyKey: string }): Promise<{ providerRef: string }>;
};
