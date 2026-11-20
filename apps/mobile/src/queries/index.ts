import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const queryKeys = {
  countries: ['countries'] as const,
  regions: ['regions'] as const,
  plans: (countryCode: string) => ['plans', countryCode] as const,
  plan: (id: string) => ['plan', id] as const,
  regionPlans: (regionId: string) => ['regionPlans', regionId] as const,
  esims: ['esims'] as const,
  esim: (iccid: string) => ['esim', iccid] as const,
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
export const useSupportThread = () => useQuery({ queryKey: queryKeys.support, queryFn: api.getSupportThread });

export function useRedeemCoupon() {
  return useMutation({ mutationFn: api.redeemCoupon });
}

export function useCreateOrder() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.createOrder,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.esims }),
  });
}

export function useTopUp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: api.topUp,
    onSuccess: (esim) => {
      client.setQueryData(queryKeys.esim(esim.iccid), esim);
      void client.invalidateQueries({ queryKey: queryKeys.esims });
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
