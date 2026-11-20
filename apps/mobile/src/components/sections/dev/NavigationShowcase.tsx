import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, IconButton, PageDots, StepBar, Tabs } from '@/components/ui';
import { ShowcaseRow, ShowcaseSection } from './ShowcaseSection';

const planTypes = ['countries', 'regions', 'global'] as const;
type PlanType = (typeof planTypes)[number];

export function NavigationShowcase() {
  const { t } = useTranslation();
  const [planType, setPlanType] = useState<PlanType>('countries');
  const [page, setPage] = useState(0);
  const [step, setStep] = useState(2);

  return (
    <ShowcaseSection title={t('dev.sections.navigation')}>
      <Tabs
        accessibilityLabel={t('dev.tabs.label')}
        value={planType}
        onChange={setPlanType}
        items={planTypes.map((key) => ({ key, label: t(`dev.chips.${key}`) }))}
      />
      <View className="gap-4 py-2">
        <PageDots count={3} index={page} />
        <ShowcaseRow className="justify-center">
          <IconButton
            icon="arrowBack"
            accessibilityLabel={t('dev.buttons.back')}
            onPress={() => setPage((value) => Math.max(0, value - 1))}
          />
          <IconButton
            icon="arrowForward"
            accessibilityLabel={t('dev.buttons.continue')}
            onPress={() => setPage((value) => Math.min(2, value + 1))}
          />
        </ShowcaseRow>
      </View>
      <StepBar total={4} current={step} />
      <ShowcaseRow>
        <Button label="−" size="sm" variant="secondary" onPress={() => setStep((value) => Math.max(1, value - 1))} />
        <Button label="+" size="sm" variant="secondary" onPress={() => setStep((value) => Math.min(4, value + 1))} />
      </ShowcaseRow>
    </ShowcaseSection>
  );
}
