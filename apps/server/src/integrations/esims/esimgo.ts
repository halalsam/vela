import type { EsimProvider, EsimUsage, ProviderPlan, PurchasedEsim, UsageQuery } from './provider';

const API = 'https://api.esim-go.com/v2.5';
const MIN_GAP_MS = 200;
const PAGE_SIZE = 200;

type Country = { iso?: string; name?: string; region?: string };

export type GoBundle = {
  name: string;
  description?: string;
  countries?: Country[];
  roamingEnabled?: Country[];
  dataAmount: number;
  duration: number;
  speed?: string[] | null;
  autostart?: boolean;
  unlimited?: boolean;
  price: number;
  billingType?: string;
};

type GoAssignment = {
  initialQuantity?: number;
  remainingQuantity?: number;
  bundleState?: string;
  startTime?: string | null;
  endTime?: string | null;
};

export class EsimGoError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(`eSIM Go ${status}: ${message}`);
    this.name = 'EsimGoError';
  }
}

const isoCodes = (list: Country[] | undefined) =>
  [...new Set((list ?? []).map((item) => item.iso?.toUpperCase()).filter((code): code is string => Boolean(code && /^[A-Z]{2}$/.test(code))))];

export function toGoPlan(bundle: GoBundle): ProviderPlan {
  const roaming = isoCodes(bundle.roamingEnabled);
  const codes = roaming.length > 0 ? roaming : isoCodes(bundle.countries);
  return {
    ref: bundle.name,
    type: codes.length > 1 ? 'regional' : 'country',
    regionRef: null,
    countryCodes: codes,
    dataMb: bundle.dataAmount,
    validityDays: bundle.duration,
    is5g: (bundle.speed ?? []).some((value) => /5G/i.test(value)),
    hotspot: true,
    networks: [],
    activation: bundle.autostart === false ? 'on_install' : 'on_first_connection',
    cost: { amountMinor: Math.round(bundle.price * 100), currency: 'USD' },
    suggestedRetail: [],
    topUps: [],
  };
}

export function toGoUsage(assignments: GoAssignment[], query: Pick<UsageQuery, 'totalMb'>): EsimUsage {
  const live = assignments.filter((item) => !['revoked', 'lapsed'].includes((item.bundleState ?? '').toLowerCase()));
  const initial = live.reduce((sum, item) => sum + (item.initialQuantity ?? 0), 0);
  const remaining = live.reduce((sum, item) => sum + (item.remainingQuantity ?? 0), 0);
  const states = live.map((item) => (item.bundleState ?? '').toLowerCase());
  const usedMb = initial > 0 ? Math.round((query.totalMb * (initial - remaining)) / initial) : 0;
  const status: EsimUsage['status'] = states.includes('active')
    ? 'active'
    : states.includes('processing') || states.includes('queued')
      ? 'not_started'
      : states.includes('depleted')
        ? 'depleted'
        : states.length > 0
          ? 'expired'
          : 'not_started';
  const started = live.map((item) => item.startTime).filter((value): value is string => Boolean(value)).sort();
  const ends = live.map((item) => item.endTime).filter((value): value is string => Boolean(value)).sort();
  return {
    usedMb,
    totalMb: query.totalMb,
    status,
    activatedAt: started[0] ? new Date(started[0]) : null,
    expiresAt: status === 'not_started' || !ends.length ? null : new Date(ends[ends.length - 1] ?? ''),
  };
}

type Options = { apiKey: string; fetch?: typeof fetch; sleep?: (ms: number) => Promise<void> };

export function createEsimGo(options: Options): EsimProvider {
  const request = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let nextSlot = 0;

  async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const now = Date.now();
    const wait = Math.max(0, nextSlot - now);
    nextSlot = Math.max(now, nextSlot) + MIN_GAP_MS;
    if (wait > 0) await sleep(wait);
    const response = await request(`${API}${path}`, {
      method: init.method ?? 'GET',
      headers: { 'X-API-Key': options.apiKey, accept: 'application/json', ...(init.body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await response.text();
    if (!response.ok) {
      const message = (() => {
        try {
          return (JSON.parse(text) as { message?: string }).message ?? text;
        } catch {
          return text;
        }
      })();
      throw new EsimGoError(response.status, message.slice(0, 200));
    }
    return JSON.parse(text) as T;
  }

  return {
    name: 'esimgo',
    async listPlans() {
      const bundles: GoBundle[] = [];
      for (let page = 1; page <= 50; page += 1) {
        const result = await call<GoBundle[] | { bundles?: GoBundle[]; pageCount?: number }>(`/catalogue?page=${page}&perPage=${PAGE_SIZE}`);
        const batch = Array.isArray(result) ? result : (result.bundles ?? []);
        bundles.push(...batch);
        const pageCount = Array.isArray(result) ? undefined : result.pageCount;
        if (batch.length < PAGE_SIZE || (pageCount !== undefined && page >= pageCount)) break;
      }
      return bundles
        .filter((bundle) => !bundle.unlimited && bundle.dataAmount > 0 && bundle.duration > 0 && (!bundle.billingType || bundle.billingType === 'FixedCost'))
        .map(toGoPlan)
        .filter((plan) => plan.countryCodes.length > 0);
    },
    async purchase({ planRef }): Promise<PurchasedEsim> {
      const result = await call<{
        orderReference?: string;
        order?: { esims?: { iccid: string; matchingId: string; smdpAddress: string }[] }[];
      }>('/orders', {
        method: 'POST',
        body: { type: 'transaction', assign: true, order: [{ type: 'bundle', quantity: 1, item: planRef, allowReassign: false }] },
      });
      let issued = result.order?.[0]?.esims?.[0];
      if (!issued && result.orderReference) {
        const details = await call<{ iccid: string; matchingId: string; smdpAddress: string } | { iccid: string; matchingId: string; smdpAddress: string }[]>(
          `/esims/assignments?reference=${encodeURIComponent(result.orderReference)}`,
        );
        issued = Array.isArray(details) ? details[0] : details;
      }
      if (!issued?.iccid || !issued.matchingId || !issued.smdpAddress) {
        throw new Error(`eSIM Go order ${result.orderReference ?? '(no reference)'} returned no eSIM; check the eSIM Go portal before retrying`);
      }
      const smdp = issued.smdpAddress.replace(/^https?:\/\//, '').replace(/\/$/, '');
      return {
        iccid: issued.iccid,
        smdp,
        activationCode: issued.matchingId,
        lpa: ['LPA:1', smdp, issued.matchingId].join('$'),
        providerRef: issued.iccid,
      };
    },
    async usage(query) {
      const result = await call<{ bundles?: { assignments?: GoAssignment[] }[] }>(`/esims/${encodeURIComponent(query.iccid)}/bundles?includeUsed=true&limit=50`);
      return toGoUsage((result.bundles ?? []).flatMap((bundle) => bundle.assignments ?? []), query);
    },
    async topUp() {
      throw new Error('Top-ups are not offered on eSIMs issued by the backup supplier');
    },
  };
}
