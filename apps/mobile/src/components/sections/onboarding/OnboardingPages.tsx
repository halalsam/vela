import { VelaSymbol } from '@vela/brand/native';
import { colors } from '@vela/tokens';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { VelaSplash } from '@/components/esim';
import { Card, Text } from '@/components/ui';

function PageCopy({ title, body }: { title: string; body: string }) {
  return (
    <View className="gap-3">
      <Text variant="display-xl" accessibilityRole="header">
        {title}
      </Text>
      <Text tone="secondary">{body}</Text>
    </View>
  );
}

export function SailPage({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 justify-between gap-8">
      <View className="flex-1 items-center justify-center">
        {active ? <VelaSplash mode="build" markHeight={120} color={colors.fg.DEFAULT} className="h-64" /> : null}
      </View>
      <PageCopy title={t('onboarding.p1Title')} body={t('onboarding.p1Body')} />
    </View>
  );
}

const steps = [
  { title: 'onboarding.s1Title', body: 'onboarding.s1Body' },
  { title: 'onboarding.s2Title', body: 'onboarding.s2Body' },
  { title: 'onboarding.s3Title', body: 'onboarding.s3Body' },
] as const;

export function StepsPage() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 justify-between gap-8">
      <View className="flex-1 justify-center gap-card-gap">
        {steps.map((step, index) => (
          <Card key={step.title} className="flex-row items-center gap-4">
            <View className="h-11 w-11 items-center justify-center rounded-pill bg-fg">
              <Text variant="data-sm" tone="inverse">
                {index + 1}
              </Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text weight="semibold">{t(step.title)}</Text>
              <Text variant="callout" tone="secondary">
                {t(step.body)}
              </Text>
            </View>
          </Card>
        ))}
      </View>
      <PageCopy title={t('onboarding.p2Title')} body={t('onboarding.p2Body')} />
    </View>
  );
}

export function NotifyPage() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 justify-between gap-8">
      <View className="flex-1 justify-center">
        <Card variant="raised" className="flex-row gap-3 rounded-card-lg">
          <View className="h-10 w-10 items-center justify-center rounded-chip bg-canvas">
            <VelaSymbol size={18} clearSpace={false} className="text-fg" />
          </View>
          <View className="flex-1 gap-0.5">
            <View className="flex-row justify-between gap-2">
              <Text variant="callout" weight="semibold" className="flex-1" numberOfLines={1}>
                {t('onboarding.sampleTitle')}
              </Text>
              <Text variant="caption" tone="tertiary">
                {t('onboarding.sampleTime')}
              </Text>
            </View>
            <Text variant="callout" tone="secondary">
              {t('onboarding.sampleBody')}
            </Text>
          </View>
        </Card>
      </View>
      <PageCopy title={t('onboarding.p3Title')} body={t('onboarding.p3Body')} />
    </View>
  );
}
