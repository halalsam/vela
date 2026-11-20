import type { Esim, Plan } from '@vela/api';
import { formatData } from '@vela/utils';
import { useCallback } from 'react';
import { useLocalized } from '@/i18n/useLocalized';
import { useRegions } from '@/queries';
import { useCountryName } from './useCountryName';

export function useDestinationName() {
  const countryName = useCountryName();
  const localized = useLocalized();
  const { data: regions } = useRegions();
  return useCallback(
    (item: Pick<Plan, 'type' | 'country_codes' | 'id'> | Pick<Esim, 'country_codes' | 'plan_id'>) => {
      const regionId = 'id' in item ? item.id.split('-')[0] : item.plan_id.split('-')[0];
      const region = regions?.find((candidate) => candidate.id === regionId);
      if (region) return localized(region.name);
      return countryName(item.country_codes[0]);
    },
    [countryName, localized, regions],
  );
}

export function usePlanTitle() {
  const destinationName = useDestinationName();
  return useCallback(
    (plan: Plan) => `${destinationName(plan)} · ${formatData(plan.data_mb)}`,
    [destinationName],
  );
}

export function useEsimTitle() {
  const destinationName = useDestinationName();
  return useCallback(
    (esim: Esim) => `${destinationName(esim)} · ${formatData(esim.data_total_mb)}`,
    [destinationName],
  );
}
