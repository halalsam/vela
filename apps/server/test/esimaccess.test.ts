import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env';
import { createEsimAccess, parseAccessDate, toProviderPlan, toUsage, type AccessPackage } from '../src/integrations/esims/esimaccess';
import { testKey } from './helpers';

const GB = 1024 * 1024 * 1024;

const japan: AccessPackage = {
  packageCode: 'JC016',
  slug: 'JP_3_15',
  name: 'Japan 3GB 15Days',
  price: 27000,
  currencyCode: 'USD',
  volume: 3 * GB,
  duration: 15,
  durationUnit: 'DAY',
  location: 'JP',
  activeType: 2,
  dataType: 1,
  speed: '4G/5G',
  supportTopUpType: 2,
  locationNetworkList: [{ locationName: 'Japan', operatorList: [{ operatorName: 'SoftBank', networkType: '5G' }, { operatorName: 'KDDI', networkType: '4G' }] }],
};

const asia: AccessPackage = {
  ...japan,
  packageCode: 'JC177',
  slug: 'AS-20_1_30',
  name: 'Asia-20 1GB 30 Days',
  volume: GB,
  duration: 30,
  location: 'MO,HK,IN,JP',
  supportTopUpType: 1,
};

const northAmerica: AccessPackage = { ...asia, packageCode: 'CKH491', slug: 'NA-3_1_7', name: 'North America 1GB 7Days', location: 'MX,US,CA' };
const dayPass: AccessPackage = { ...japan, packageCode: 'DP1', slug: 'JP_DAY', dataType: 2 };

type Call = { path: string; body: Record<string, unknown>; code: string | null };

function fakeApi(handler: (path: string, body: Record<string, unknown>) => unknown) {
  const calls: Call[] = [];
  const request = (async (url: string, init?: RequestInit) => {
    const path = url.replace('https://api.esimaccess.com/api/v1/open', '');
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    calls.push({ path, body, code: new Headers(init?.headers).get('RT-AccessCode') });
    return Response.json(handler(path, body));
  }) as typeof fetch;
  return { calls, request };
}

const ok = (obj: unknown) => ({ success: true, errorCode: null, errorMsg: null, obj });
const fail = (errorCode: string, errorMsg: string) => ({ success: false, errorCode, errorMsg, obj: null });
const noSleep = async () => undefined;

describe('eSIM Access mapping', () => {
  it('turns a country package into a plan with USD cost in cents', () => {
    expect(toProviderPlan(japan)).toMatchObject({
      ref: 'JP_3_15',
      type: 'country',
      regionRef: null,
      countryCodes: ['JP'],
      dataMb: 3072,
      validityDays: 15,
      is5g: true,
      networks: ['SoftBank', 'KDDI'],
      activation: 'on_first_connection',
      cost: { amountMinor: 270, currency: 'USD' },
      suggestedRetail: [],
    });
  });

  it('maps multi-country packages onto our regions, or a new region named after the package', () => {
    expect(toProviderPlan(asia)).toMatchObject({ type: 'regional', regionRef: 'asia', regionName: 'Asia-20', countryCodes: ['MO', 'HK', 'IN', 'JP'] });
    expect(toProviderPlan(northAmerica)).toMatchObject({ type: 'regional', regionRef: 'na-3', regionName: 'North America' });
    expect(toProviderPlan({ ...asia, name: 'Global139 1GB 7Days', slug: 'GL-139_1_7' })).toMatchObject({ type: 'global', regionRef: 'global' });
  });

  it('reads their dates and statuses', () => {
    expect(parseAccessDate('2024-05-29T18:34:17+0000')?.toISOString()).toBe('2024-05-29T18:34:17.000Z');
    const base = { esimTranNo: 'T1', iccid: '8943108170000775671', ac: 'LPA:1$x$y', totalVolume: 5 * GB, orderUsage: 0 };
    expect(toUsage({ ...base, esimStatus: 'GOT_RESOURCE', expiredTime: '2024-05-29T18:34:17+0000' })).toMatchObject({ status: 'not_started', expiresAt: null, totalMb: 5120 });
    expect(toUsage({ ...base, esimStatus: 'IN_USE', orderUsage: GB, activateTime: '2024-05-01T10:00:00+0000', expiredTime: '2024-05-31T10:00:00+0000' })).toMatchObject({
      status: 'active',
      usedMb: 1024,
      activatedAt: new Date('2024-05-01T10:00:00Z'),
      expiresAt: new Date('2024-05-31T10:00:00Z'),
    });
    expect(toUsage({ ...base, esimStatus: 'USED_UP', orderUsage: 5 * GB }).status).toBe('depleted');
    expect(toUsage({ ...base, esimStatus: 'UNUSED_EXPIRED' }).status).toBe('expired');
  });
});

describe('eSIM Access client', () => {
  it('lists fixed-data plans, with top-ups fetched once per coverage area', async () => {
    const topUp = { ...japan, packageCode: 'TOPUP_JC063', slug: null, name: 'Japan 1GB 7Days', volume: GB, duration: 7, price: 7000 };
    const api = fakeApi((path, body) =>
      path === '/package/list' && body.type === 'TOPUP' ? ok({ packageList: [topUp] }) : ok({ packageList: [japan, { ...japan, slug: 'JP_5_30' }, asia, dayPass] }),
    );
    const plans = await createEsimAccess({ accessCode: 'code-1', fetch: api.request, sleep: noSleep }).listPlans();
    expect(plans.map((item) => item.ref)).toEqual(['JP_3_15', 'JP_5_30', 'AS-20_1_30']);
    expect(plans[0]?.topUps).toEqual([{ ref: 'TOPUP_JC063', dataMb: 1024, extraDays: 7, cost: { amountMinor: 70, currency: 'USD' }, suggestedRetail: [] }]);
    expect(plans[2]?.topUps).toEqual([]);
    expect(api.calls.filter((call) => call.body.type === 'TOPUP')).toHaveLength(1);
    expect(api.calls.every((call) => call.code === 'code-1')).toBe(true);
  });

  it('orders with our order ID and waits while the profile is being allocated', async () => {
    let queries = 0;
    const api = fakeApi((path) => {
      if (path === '/esim/order') return ok({ orderNo: 'B23051616050537', transactionId: 'order-1' });
      queries += 1;
      if (queries < 3) return fail('200010', 'Profile is being downloaded for the order.');
      return ok({ esimList: [{ esimTranNo: '23120118156818', iccid: '8943108170000775671', ac: 'LPA:1$rsp-eu.redteamobile.com$43DE23C6', esimStatus: 'GOT_RESOURCE', totalVolume: GB, orderUsage: 0 }] });
    });
    const bought = await createEsimAccess({ accessCode: 'c', fetch: api.request, sleep: noSleep }).purchase({ planRef: 'JP_3_15', idempotencyKey: 'order-1' });
    expect(bought).toEqual({
      iccid: '8943108170000775671',
      lpa: 'LPA:1$rsp-eu.redteamobile.com$43DE23C6',
      smdp: 'rsp-eu.redteamobile.com',
      activationCode: '43DE23C6',
      providerRef: '23120118156818',
    });
    expect(api.calls[0]?.body).toEqual({ transactionId: 'order-1', packageInfoList: [{ packageCode: 'JP_3_15', count: 1 }] });
    expect(api.calls.filter((call) => call.path === '/esim/query')).toHaveLength(3);
  });

  it('stops on real errors and when allocation takes too long', async () => {
    const broke = fakeApi((path) => (path === '/esim/order' ? fail('200007', 'Insufficient account balance') : ok(null)));
    await expect(createEsimAccess({ accessCode: 'c', fetch: broke.request, sleep: noSleep }).purchase({ planRef: 'X', idempotencyKey: 'k' })).rejects.toThrow(
      'eSIM Access 200007: Insufficient account balance',
    );
    const slow = fakeApi((path) => (path === '/esim/order' ? ok({ orderNo: 'B1' }) : fail('200010', 'still allocating')));
    await expect(
      createEsimAccess({ accessCode: 'c', fetch: slow.request, sleep: noSleep, pollAttempts: 2 }).purchase({ planRef: 'X', idempotencyKey: 'k' }),
    ).rejects.toThrow('was not ready in time');
  });

  it('reads usage by eSIM transaction number and tops up with our order ID', async () => {
    const api = fakeApi((path) =>
      path === '/esim/topup'
        ? ok({ transactionId: 'order-9', topUpEsimTranNo: '26032702180013' })
        : ok({ esimList: [{ esimTranNo: 'T9', iccid: '1', ac: 'LPA:1$a$b', esimStatus: 'IN_USE', orderUsage: 512 * 1024 * 1024, totalVolume: GB, activateTime: '2026-11-01T00:00:00+0000', expiredTime: '2026-11-08T00:00:00+0000' }] }),
    );
    const provider = createEsimAccess({ accessCode: 'c', fetch: api.request, sleep: noSleep });
    const usage = await provider.usage({ iccid: '1', providerRef: 'T9', purchasedAt: new Date(), planMb: 1024, totalMb: 1024, validityDays: 7, extraDays: 0 });
    expect(usage).toMatchObject({ status: 'active', usedMb: 512, totalMb: 1024 });
    expect(api.calls[0]?.body).toMatchObject({ esimTranNo: 'T9' });
    expect(await provider.topUp({ iccid: '1', providerRef: 'T9', packRef: 'TOPUP_JC063', idempotencyKey: 'order-9' })).toEqual({ providerRef: '26032702180013' });
    expect(api.calls[1]?.body).toEqual({ esimTranNo: 'T9', packageCode: 'TOPUP_JC063', transactionId: 'order-9' });
  });

  it('cancels an uninstalled eSIM and reports when the supplier refuses', async () => {
    let refuse = false;
    const api = fakeApi(() => (refuse ? fail('200002', 'This operation is not allowed due to the order status.') : ok({})));
    const provider = createEsimAccess({ accessCode: 'c', fetch: api.request, sleep: noSleep });
    expect(await provider.cancel?.({ iccid: '1', providerRef: 'T1' })).toBe(true);
    expect(api.calls[0]).toMatchObject({ path: '/esim/cancel', body: { esimTranNo: 'T1' } });
    refuse = true;
    expect(await provider.cancel?.({ iccid: '1', providerRef: 'T1' })).toBe(false);
  });

  it('needs an access code, and production needs a real provider', () => {
    const base = { DATABASE_URL: 'postgres://x', ENCRYPTION_KEY: testKey, BETTER_AUTH_SECRET: 'x'.repeat(32) };
    expect(() => loadEnv({ ...base, ESIM_PROVIDER: 'esimaccess' })).toThrow(/eSIM Access needs its access code/);
    expect(() => loadEnv({ ...base, APP_ENV: 'production' })).toThrow(/production must sell real eSIMs/);
  });
});
