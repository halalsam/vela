import type { TypeToken } from '@vela/tokens';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card, Text } from '@/components/ui';
import { ShowcaseSection } from './ShowcaseSection';

const rows: { variant: TypeToken; sample: string }[] = [
  { variant: 'display-xl', sample: 'dev.samples.display' },
  { variant: 'display-lg', sample: 'dev.samples.display' },
  { variant: 'display-md', sample: 'dev.samples.display' },
  { variant: 'title', sample: 'dev.samples.title' },
  { variant: 'body', sample: 'dev.samples.body' },
  { variant: 'callout', sample: 'dev.samples.callout' },
  { variant: 'caption', sample: 'dev.samples.caption' },
  { variant: 'label', sample: 'dev.samples.label' },
  { variant: 'label-sm', sample: 'dev.samples.label' },
  { variant: 'data-xl', sample: 'dev.samples.dataXl' },
  { variant: 'data-lg', sample: 'dev.samples.dataXl' },
  { variant: 'data-md', sample: 'dev.samples.dataMd' },
  { variant: 'data-sm', sample: 'dev.samples.dataSm' },
];

export function TypographyShowcase() {
  const { t } = useTranslation();
  return (
    <ShowcaseSection title={t('dev.sections.typography')} note={t('dev.notes.typography')}>
      <Card padding="lg" className="gap-4">
        {rows.map((row) => (
          <View key={row.variant} className="gap-1">
            <Text variant="label-sm" tone="quaternary">
              {row.variant}
            </Text>
            <Text variant={row.variant}>{t(row.sample)}</Text>
          </View>
        ))}
        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          <Text tone="secondary">secondary</Text>
          <Text tone="tertiary">tertiary</Text>
          <Text tone="quaternary">quaternary</Text>
          <Text tone="accent">accent</Text>
          <Text tone="success">success</Text>
          <Text tone="warning">warning</Text>
          <Text tone="danger">danger</Text>
        </View>
      </Card>
    </ShowcaseSection>
  );
}
