import type { Country, Region } from '@vela/api';
import { formatPrice } from '@vela/utils';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { CountryRow, FlagStack, RegionRow } from '@/components/esim';
import { Card, ListGroup, Pill, Text } from '@/components/ui';
import { useLocalized } from '@/i18n/useLocalized';

export function openDestination(code: string) {
  router.push({ pathname: '/country/[code]', params: { code } });
}

export function CountryGroupList({ countries }: { countries: readonly Country[] }) {
  return (
    <ListGroup>
      {countries.map((country) => (
        <CountryRow key={country.code} country={country} onPress={() => openDestination(country.code)} />
      ))}
    </ListGroup>
  );
}

export function RegionList({ regions }: { regions: readonly Region[] }) {
  return (
    <ListGroup>
      {regions.map((region) => (
        <RegionRow key={region.id} region={region} onPress={() => openDestination(region.id)} />
      ))}
    </ListGroup>
  );
}

export function GlobalCard({ region }: { region: Region }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  return (
    <Card padding="lg" className="gap-5" accessibilityLabel={localized(region.name)} onPress={() => openDestination(region.id)}>
      <FlagStack codes={region.country_codes} size="lg" max={5} />
      <View className="gap-2">
        <Text variant="display-lg">{t('explore.globalTitle')}</Text>
        <Text tone="secondary">{t('explore.globalBody', { count: region.country_codes.length })}</Text>
      </View>
      <Pill label={t('esim.from', { price: formatPrice(region.from_price, region.currency) })} tone="accent" />
    </Card>
  );
}
