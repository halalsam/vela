import { z } from 'zod';
import * as mocks from './mocks';
import {
  countrySchema,
  dailyUsageSchema,
  esimSchema,
  offerSchema,
  planSchema,
  regionSchema,
  topUpPackSchema,
  type Country,
  type DailyUsage,
  type Esim,
  type Offer,
  type Plan,
  type Region,
  type TopUpPack,
} from './schemas';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type VelaApi = {
  getCountries(): Promise<Country[]>;
  getRegions(): Promise<Region[]>;
  getPlans(countryCode: string): Promise<Plan[]>;
  getPlan(id: string): Promise<Plan>;
  getEsims(): Promise<Esim[]>;
  getEsim(iccid: string): Promise<Esim>;
  getOffers(): Promise<Offer[]>;
  getTopUpPacks(iccid: string): Promise<TopUpPack[]>;
  getDailyUsage(iccid: string): Promise<DailyUsage[]>;
};

export type MockApiOptions = {
  latencyMs?: number;
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function notFound(what: string): never {
  throw new ApiError(`${what} not found`, 404);
}

export function createMockApi({ latencyMs = 450 }: MockApiOptions = {}): VelaApi {
  async function respond<T>(schema: z.ZodType<T>, data: unknown): Promise<T> {
    await wait(latencyMs);
    return schema.parse(data);
  }

  return {
    getCountries: () => respond(z.array(countrySchema), mocks.countries),
    getRegions: () => respond(z.array(regionSchema), mocks.regions),
    getPlans: (countryCode) =>
      respond(
        z.array(planSchema),
        mocks.plans.filter((plan) => plan.country_codes.includes(countryCode.toUpperCase())),
      ),
    getPlan: async (id) => respond(planSchema, mocks.plans.find((plan) => plan.id === id) ?? notFound('Plan')),
    getEsims: () => respond(z.array(esimSchema), mocks.esims),
    getEsim: async (iccid) => respond(esimSchema, mocks.esims.find((esim) => esim.iccid === iccid) ?? notFound('eSIM')),
    getOffers: () => respond(z.array(offerSchema), mocks.offers),
    getTopUpPacks: (iccid) => respond(z.array(topUpPackSchema), mocks.topUpPacks.filter((pack) => pack.iccid === iccid)),
    getDailyUsage: (iccid) => respond(z.array(dailyUsageSchema), mocks.dailyUsage[iccid] ?? []),
  };
}
