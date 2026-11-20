import { useCallback, useMemo } from 'react';
import { useLocalized } from '@/i18n/useLocalized';
import { useCountries } from '@/queries';

export function useCountryName() {
  const { data } = useCountries();
  const localized = useLocalized();
  const byCode = useMemo(() => new Map((data ?? []).map((country) => [country.code, country])), [data]);
  return useCallback(
    (code: string | undefined) => {
      if (!code) return '';
      const country = byCode.get(code);
      return country ? localized(country.name) : code;
    },
    [byCode, localized],
  );
}
