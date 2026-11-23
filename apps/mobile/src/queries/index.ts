import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateOrderInput, Order, OrderStatus } from '@vela/api';
import { api, usingLiveCatalog } from '@/lib/api';
import { collectPayment } from '@/lib/payments';

export const queryKeys = {
  countries: ['countries'] as const,
  regions: ['regions'] as const,
  plans: (countryCode: string) => ['plans', countryCode] as const,
  plan: (id: string) => ['plan', id] as const,
  regionPlans: (regionId: string) => ['regionPlans', regionId] as const,
  esims: ['esims'] as const,
  esim: (iccid: string) => ['esim', iccid] as const,
  order: (id: string) => ['order', id] as const,
  offers: ['offers'] as const,
  topUpPacks: (iccid: string) => ['topUpPacks', iccid] as const,
  dailyUsage: (iccid: string) => ['dailyUsage', iccid] as const,
  profile: ['profile'] as const,
  rewards: ['rewards'] as const,
  support: ['support'] as const,
};

export const useCountries = () => useQuery({ queryKey: queryKeys.countries, queryFn: api.getCountries, staleTime: 3_600_000 });
export const useRegions = () => useQuery({ queryKey: queryKeys.regions, queryFn: api.getRegions, staleTime: 3_600_000 });
export const usePlans = (countryCode: string) =>
  useQuery({ queryKey: queryKeys.plans(countryCode), queryFn: () => api.getPlans(countryCode), enabled: countryCode.length === 2 });
export const useRegionPlans = (regionId: string | undefined) =>
  useQuery({ queryKey: queryKeys.regionPlans(regionId ?? ''), queryFn: () => api.getRegionPlans(regionId ?? ''), enabled: Boolean(regionId) });
export const usePlan = (id: string | undefined) =>
  useQuery({ queryKey: queryKeys.plan(id ?? ''), queryFn: () => api.getPlan(id ?? ''), enabled: Boolean(id) });
export const useEsims = () => useQuery({ queryKey: queryKeys.esims, queryFn: api.getEsims });
export const useEsim = (iccid: string | undefined) =>
  useQuery({ queryKey: queryKeys.esim(iccid ?? ''), queryFn: () => api.getEsim(iccid ?? ''), enabled: Boolean(iccid) });
export const useOffers = () => useQuery({ queryKey: queryKeys.offers, queryFn: api.getOffers });
export const useTopUpPacks = (iccid: string | undefined) =>
  useQuery({ queryKey: queryKeys.topUpPacks(iccid ?? ''), queryFn: () => api.getTopUpPacks(iccid ?? ''), enabled: Boolean(iccid) });
export const useDailyUsage = (iccid: string | undefined) =>
  useQuery({ queryKey: queryKeys.dailyUsage(iccid ?? ''), queryFn: () => api.getDailyUsage(iccid ?? ''), enabled: Boolean(iccid) });
export const useProfile = () => useQuery({ queryKey: queryKeys.profile, queryFn: api.getProfile });
export const useRewards = () => useQuery({ queryKey: queryKeys.rewards, queryFn: api.getRewards });
export const useSupportThread = () =>
  useQuery({ queryKey: queryKeys.support, queryFn: api.getSupportThread, refetchInterval: usingLiveCatalog ? 5000 : false });

export function useRedeemCoupon() {
  return useMutation({ mutationFn: api.redeemCoupon });
}

const SETTLED: OrderStatus[] = ['fulfilled', 'provisioning_failed', 'refunded', 'expired'];

export const useOrder = (orderId: string | undefined, poll: boolean) =>
  useQuery({
    queryKey: queryKeys.order(orderId ?? ''),
    queryFn: () => api.getOrder(orderId ?? ''),
    enabled: Boolean(orderId) && poll,
    refetchInterval: (query) => (query.state.data && SETTLED.includes(query.state.data.status) ? false : 2000),
  });

export function usePurchase() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOrderInput & { description: string }): Promise<Order> => {
      const checkout = await api.createOrder(input);
      const result = await collectPayment(checkout, input.description);
      return result ? api.confirmPayment(checkout.order.order_id, result) : checkout.order;
    },
    onSuccess: (order) => {
      client.setQueryData(queryKeys.order(order.order_id), order);
      void client.invalidateQueries({ queryKey: queryKeys.esims });
      void client.invalidateQueries({ queryKey: queryKeys.rewards });
    },
  });
}

const TOP_UP_WAIT_MS = 30_000;

export class TopUpPending extends Error {}

async function waitUntilFulfilled(order: Order): Promise<Order> {
  const started = Date.now();
  let current = order;
  while (current.status !== 'fulfilled') {
    if (current.status === 'provisioning_failed' || current.status === 'refunded') throw new Error('Top-up failed');
    if (Date.now() - started > TOP_UP_WAIT_MS) throw new TopUpPending();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    current = await api.getOrder(current.order_id);
  }
  return current;
}

export function useTopUp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { iccid: string; packId: string; idempotencyKey: string; description: string }) => {
      const checkout = await api.topUp(input);
      const result = await collectPayment(checkout, input.description);
      const paid = result ? await api.confirmPayment(checkout.order.order_id, result) : checkout.order;
      return waitUntilFulfilled(paid);
    },
    onSettled: (_order, _error, input) => {
      void client.invalidateQueries({ queryKey: queryKeys.esim(input.iccid) });
      void client.invalidateQueries({ queryKey: queryKeys.esims });
      void client.invalidateQueries({ queryKey: queryKeys.rewards });
    },
  });
}

export function useSendSupportMessage() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.sendSupportMessage,
    onSuccess: (thread) => client.setQueryData(queryKeys.support, thread),
  });
}
