import { ProviderUnavailable, type EsimProvider, type EsimUsage, type ProviderPlan, type ProviderTopUp, type PurchasedEsim } from '../provider';

const API = 'https://api.esimaccess.com/api/v1/open';
const BYTES_PER_MB = 1024 * 1024;
const MIN_GAP_MS = 150;
const NOT_READY = '200010';
const ORDER_REFUSED = new Set(['200005', '200006', '200007', '200008', '200011', '310201', '310241', '310243', '401', '403']);

type Envelope<T> = { success: boolean | string; errorCode: string | null; errorMsg?: string | null; errorMessage?: string | null; obj: T | null };

export type AccessPackage = {
  packageCode: string;
  slug?: string | null;
  name: string;
  price: number;
  currencyCode: string;
  volume: number;
  duration: number;
  durationUnit: string;
  location: string;
  activeType?: number;
  dataType?: number;
  speed?: string | null;
  supportTopUpType?: number | boolean | null;
  locationNetworkList?: { locationName?: string; operatorList?: { operatorName?: string; networkType?: string }[] | null }[] | null;
};

type AccessProfile = {
  esimTranNo: string;
  iccid: string;
  ac: string;
  esimStatus: string;
  smdpStatus?: string;
  activateTime?: string | null;
  expiredTime?: string | null;
  totalVolume: number;
  orderUsage: number;
};

export class EsimAccessError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(`eSIM Access ${code}: ${message}`);
    this.name = 'EsimAccessError';
  }
}

export function parseAccessDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
  return Number.isNaN(date.getTime()) ? null : date;
}

const usdCents = (price: number) => Math.round(price / 100);
const megabytes = (bytes: number) => Math.round(bytes / BYTES_PER_MB);
const isFixedDataPlan = (item: AccessPackage) => (item.dataType === undefined || item.dataType === 1) && item.durationUnit === 'DAY' && item.volume > 0;

function regionFor(item: AccessPackage): { ref: string; name: string; type: 'regional' | 'global' } {
  const name = item.name.replace(/\s+\d+(\.\d+)?\s*(GB|MB)\b.*$/i, '').trim() || item.name;
  if (/global/i.test(name)) return { ref: 'global', name, type: 'global' };
  if (/europe/i.test(name)) return { ref: 'europe', name, type: 'regional' };
  if (/(gulf|middle east|gcc)/i.test(name)) return { ref: 'gulf', name, type: 'regional' };
  if (/asia/i.test(name)) return { ref: 'asia', name, type: 'regional' };
  const prefix = (item.slug ?? item.packageCode).split('_')[0] ?? item.packageCode;
  return { ref: prefix.toLowerCase(), name, type: 'regional' };
}

export function toProviderPlan(item: AccessPackage, topUps: ProviderTopUp[] = []): ProviderPlan {
  const codes = item.location
    .split(',')
    .map((code) => code.trim().toUpperCase())
    .filter((code) => /^[A-Z]{2}$/.test(code));
  const operators = (item.locationNetworkList ?? []).flatMap((entry) => entry.operatorList ?? []);
  const networks = [...new Set(operators.map((operator) => operator.operatorName).filter((value): value is string => Boolean(value)))];
  const is5g = /5G/i.test(item.speed ?? '') || operators.some((operator) => /5G/i.test(operator.networkType ?? ''));
  const region = codes.length > 1 ? regionFor(item) : null;
  return {
    ref: item.slug || item.packageCode,
    type: region ? region.type : 'country',
    regionRef: region?.ref ?? null,
    ...(region ? { regionName: region.name } : {}),
    countryCodes: codes,
    dataMb: megabytes(item.volume),
    validityDays: item.duration,
    is5g,
    hotspot: true,
    networks: networks.slice(0, 6),
    activation: item.activeType === 2 ? 'on_first_connection' : 'on_install',
    cost: { amountMinor: usdCents(item.price), currency: 'USD' },
    suggestedRetail: [],
    topUps,
  };
}

export function toTopUp(item: AccessPackage): ProviderTopUp {
  return {
    ref: item.packageCode,
    dataMb: megabytes(item.volume),
    extraDays: item.durationUnit === 'DAY' ? item.duration : 0,
    cost: { amountMinor: usdCents(item.price), currency: 'USD' },
    suggestedRetail: [],
  };
}

export function toUsage(profile: AccessProfile): EsimUsage {
  const usedMb = megabytes(profile.orderUsage ?? 0);
  const totalMb = megabytes(profile.totalVolume ?? 0);
  const activatedAt = parseAccessDate(profile.activateTime);
  const started = usedMb > 0 || activatedAt !== null;
  const status = ((): EsimUsage['status'] => {
    switch (profile.esimStatus) {
      case 'USED_UP':
        return 'depleted';
      case 'USED_EXPIRED':
      case 'UNUSED_EXPIRED':
      case 'CANCEL':
      case 'REVOKED':
        return 'expired';
      case 'IN_USE':
      case 'SUSPENDED':
        return started ? 'active' : 'not_started';
      default:
        return 'not_started';
    }
  })();
  return { usedMb, totalMb, status, activatedAt, expiresAt: status === 'not_started' ? null : parseAccessDate(profile.expiredTime) };
}

type Options = { accessCode: string; fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; pollAttempts?: number; pollIntervalMs?: number };

export function createEsimAccess(options: Options): EsimProvider {
  const request = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let nextSlot = 0;

  async function call<T>(path: string, body: unknown): Promise<T> {
    const now = Date.now();
    const wait = Math.max(0, nextSlot - now);
    nextSlot = Math.max(now, nextSlot) + MIN_GAP_MS;
    if (wait > 0) await sleep(wait);
    const response = await request(`${API}${path}`, {
      method: 'POST',
      headers: { 'RT-AccessCode': options.accessCode, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) throw new EsimAccessError(String(response.status), text.slice(0, 200));
    const envelope = JSON.parse(text) as Envelope<T>;
    if (envelope.success !== true && envelope.success !== 'true') {
      throw new EsimAccessError(envelope.errorCode ?? 'unknown', envelope.errorMsg ?? envelope.errorMessage ?? 'request failed');
    }
    return envelope.obj as T;
  }

  async function profileBy(query: Record<string, unknown>): Promise<AccessProfile | null> {
    const result = await call<{ esimList: AccessProfile[] }>('/esim/query', { iccid: '', ...query, pager: { pageNum: 1, pageSize: 5 } });
    return result?.esimList?.[0] ?? null;
  }

  return {
    name: 'esimaccess',
    async listPlans() {
      const result = await call<{ packageList: AccessPackage[] }>('/package/list', { locationCode: '', type: 'BASE', packageCode: '', iccid: '' });
      const base = (result?.packageList ?? []).filter(isFixedDataPlan);
      const groups = new Map<string, AccessPackage[]>();
      for (const item of base) groups.set(item.location, [...(groups.get(item.location) ?? []), item]);
      const topUpsByLocation = new Map<string, ProviderTopUp[]>();
      for (const [location, items] of groups) {
        const sample = items.find((item) => item.supportTopUpType === 2 || item.supportTopUpType === 3 || item.supportTopUpType === true);
        if (!sample) continue;
        const packs = await call<{ packageList: AccessPackage[] }>('/package/list', {
          locationCode: '',
          type: 'TOPUP',
          packageCode: sample.slug || sample.packageCode,
          iccid: '',
        });
        topUpsByLocation.set(location, (packs?.packageList ?? []).filter(isFixedDataPlan).map(toTopUp));
      }
      return base.map((item) => toProviderPlan(item, topUpsByLocation.get(item.location) ?? []));
    },
    async purchase({ planRef, idempotencyKey }): Promise<PurchasedEsim> {
      const ordered = await call<{ orderNo: string }>('/esim/order', {
        transactionId: idempotencyKey,
        packageInfoList: [{ packageCode: planRef, count: 1 }],
      }).catch((error: unknown) => {
        if (error instanceof EsimAccessError && ORDER_REFUSED.has(error.code)) throw new ProviderUnavailable('esimaccess', error.message);
        throw error;
      });
      const attempts = options.pollAttempts ?? 15;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        try {
          const profile = await profileBy({ orderNo: ordered.orderNo });
          if (profile?.ac && profile.iccid) {
            const [, smdp = '', activationCode = ''] = profile.ac.split('$');
            return { iccid: profile.iccid, lpa: profile.ac, smdp, activationCode, providerRef: profile.esimTranNo };
          }
        } catch (error) {
          if (!(error instanceof EsimAccessError) || error.code !== NOT_READY) throw error;
        }
        await sleep(options.pollIntervalMs ?? 3000);
      }
      throw new Error(`eSIM Access order ${ordered.orderNo} was not ready in time`);
    },
    async usage(query) {
      const profile = await profileBy({ esimTranNo: query.providerRef });
      if (!profile) throw new Error(`eSIM Access has no profile ${query.providerRef}`);
      return toUsage(profile);
    },
    async cancel({ providerRef }) {
      try {
        await call('/esim/cancel', { esimTranNo: providerRef });
        return true;
      } catch (error) {
        if (error instanceof EsimAccessError) return false;
        throw error;
      }
    },
    async topUp({ providerRef, packRef, idempotencyKey }) {
      const result = await call<{ topUpEsimTranNo?: string; transactionId: string }>('/esim/topup', {
        esimTranNo: providerRef,
        packageCode: packRef,
        transactionId: idempotencyKey,
      });
      return { providerRef: result?.topUpEsimTranNo ?? result?.transactionId ?? idempotencyKey };
    },
  };
}
