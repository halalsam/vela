import type { Country, Region } from '@vela/api';
import { formatPrice } from '@vela/utils';
import { useTranslation } from 'react-i18next';
import { ListRow } from '@/components/ui';
import { useLocalized } from '@/i18n/useLocalized';
import { Flag, FlagStack } from './Flag';

export type CountryRowProps = {
  country: Country;
  onPress?: () => void;
};

export function CountryRow({ country, onPress }: CountryRowProps) {
  const { t } = useTranslation();
  const localized = useLocalized();
  return (
    <ListRow
      leading={<Flag code={country.code} size="md" />}
      title={localized(country.name)}
      value={t('esim.from', { price: formatPrice(country.from_price, country.currency) })}
      onPress={onPress}
    />
  );
}

export type RegionRowProps = {
  region: Region;
  onPress?: () => void;
};

export function RegionRow({ region, onPress }: RegionRowProps) {
  const { t } = useTranslation();
  const localized = useLocalized();
  return (
    <ListRow
      leading={<FlagStack codes={region.country_codes} size="md" />}
      title={localized(region.name)}
      subtitle={t('esim.countries', { count: region.country_codes.length })}
      value={t('esim.from', { price: formatPrice(region.from_price, region.currency) })}
      onPress={onPress}
    />
  );
}
