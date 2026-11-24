import type { Country, Region } from '@vela/api';
import { formatPrice } from '@vela/utils';
import { Link, router } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { CountryRow, FlagStack, RegionRow } from '@/components/esim';
import { Card, ListGroup, Pill, Text } from '@/components/ui';
import { useLocalized } from '@/i18n/useLocalized';

export function openDestination(code: string) {
  router.push({ pathname: '/country/[code]', params: { code } });
}

export function DestinationLink({ code, children }: { code: string; children: ReactElement }) {
  return (
    <Link href={{ pathname: '/country/[code]', params: { code } }} asChild>
      <Link.AppleZoom>{children}</Link.AppleZoom>
    </Link>
  );
}

export function CountryGroupList({ countries }: { countries: readonly Country[] }) {
  return (
    <ListGroup>
      {countries.map((country) => (
        <DestinationLink key={country.code} code={country.code}>
          <CountryRow country={country} />
        </DestinationLink>
      ))}
    </ListGroup>
  );
}

export function RegionList({ regions }: { regions: readonly Region[] }) {
  return (
    <ListGroup>
      {regions.map((region) => (
        <DestinationLink key={region.id} code={region.id}>
          <RegionRow region={region} />
        </DestinationLink>
      ))}
    </ListGroup>
  );
}

export function GlobalCard({ region }: { region: Region }) {
  const { t } = useTranslation();
  const localized = useLocalized();
  return (
    <DestinationLink code={region.id}>
      <Card padding="md" className="gap-3" accessibilityLabel={localized(region.name)}>
        <FlagStack codes={region.country_codes} size="md" max={5} />
        <View className="gap-1">
          <Text variant="display-md">{t('explore.globalTitle')}</Text>
          <Text variant="callout" tone="secondary">
            {t('explore.globalBody', { count: region.country_codes.length })}
          </Text>
        </View>
        <Pill label={t('esim.from', { price: formatPrice(region.from_price, region.currency) })} tone="accent" size="sm" />
      </Card>
    </DestinationLink>
  );
}
