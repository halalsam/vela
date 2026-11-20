import type { Plan } from '@vela/api';
import { bestValuePlanId, dataParts } from '@vela/utils';
import { BlurView } from 'expo-blur';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Flag, FlagStack, PlanCard, PriceOdometer } from '@/components/esim';
import { Button, Icon, ListGroup, ListRow, Pill, Skeleton, Text } from '@/components/ui';
import { useStaggerIn } from '@/hooks/useStaggerIn';

export type Destination = {
  id: string;
  name: string;
  codes: readonly string[];
  isRegion: boolean;
};

export function DestinationHero({ destination, plans }: { destination: Destination; plans: readonly Plan[] }) {
  const { t } = useTranslation();
  const has5g = plans.some((plan) => plan.is_5g);
  const hotspot = plans.some((plan) => plan.hotspot);
  return (
    <View className="items-center gap-5 pb-2 pt-4">
      <Link.AppleZoomTarget>
        <View>
          {destination.isRegion ? <FlagStack codes={destination.codes} size="xl" max={4} /> : <Flag code={destination.codes[0] ?? ''} size="hero" />}
        </View>
      </Link.AppleZoomTarget>
      <View className="items-center gap-2">
        <Text variant="display-xl" align="center" accessibilityRole="header">
          {destination.name}
        </Text>
        <Text variant="callout" tone="secondary" align="center">
          {t('country.dataOnly')}
        </Text>
      </View>
      <View className="flex-row flex-wrap justify-center gap-2">
        {has5g ? <Pill label={t('esim.fiveG')} icon="signal" /> : null}
        {hotspot ? <Pill label={t('esim.hotspot')} /> : null}
        <Pill label={t('country.instant')} icon="bolt" />
      </View>
    </View>
  );
}

function StaggeredPlan({ index, ...props }: React.ComponentProps<typeof PlanCard> & { index: number }) {
  const entering = useStaggerIn(index);
  return (
    <Animated.View entering={entering}>
      <PlanCard {...props} />
    </Animated.View>
  );
}

export function PlanPicker({
  plans,
  selectedId,
  onSelect,
  label,
}: {
  plans: readonly Plan[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  label: string;
}) {
  const best = bestValuePlanId(plans);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} className="gap-card-gap">
      {plans.map((plan, index) => (
        <StaggeredPlan
          key={plan.id}
          index={index}
          plan={plan}
          selected={plan.id === selectedId}
          dimmed={Boolean(selectedId) && plan.id !== selectedId}
          bestValue={plan.id === best}
          onPress={() => onSelect(plan.id)}
        />
      ))}
    </View>
  );
}

export function DestinationFacts({ plan }: { plan: Plan | undefined }) {
  const { t } = useTranslation();
  if (!plan) return null;
  return (
    <ListGroup>
      <ListRow leadingIcon="signal" title={t('country.networks')} subtitle={plan.networks.join(' · ')} />
      <ListRow
        leading={
          <View className="h-8 w-8 items-center justify-center rounded-chip bg-success-tint">
            <Icon name="check" size={15} tone="success" weight="bold" />
          </View>
        }
        title={t('country.compatibleTitle')}
        subtitle={t('country.compatibleBody')}
      />
    </ListGroup>
  );
}

export function PlanBar({ plan, onContinue }: { plan: Plan | undefined; onContinue: () => void }) {
  const { t } = useTranslation();
  if (!plan) return null;
  const data = dataParts(plan.data_mb);
  return (
    <View className="absolute inset-x-3 bottom-safe-offset-2 overflow-hidden rounded-sheet border border-line border-t-line-highlight">
      <BlurView intensity={50} tint="dark" className="absolute inset-0" />
      <View className="flex-row items-center gap-3 bg-surface-1/70 py-2.5 pe-2.5 ps-5">
        <View className="flex-1">
          <Text variant="caption" tone="tertiary">
            {t('country.selected', { data: `${data.value} ${data.unit}`, days: t('esim.days', { count: plan.validity_days }) })}
          </Text>
          <PriceOdometer amount={plan.price} currency={plan.currency} variant="data-sm" />
        </View>
        <Button label={t('common.continue')} onPress={onContinue} icon="arrowForward" iconPosition="end" />
      </View>
    </View>
  );
}

export function DestinationSkeleton() {
  return (
    <View className="gap-card-gap pt-6">
      <View className="items-center gap-4 pb-6">
        <Skeleton className="h-28 w-28 rounded-pill" />
        <Skeleton className="h-9 w-1/2 rounded-pill" />
        <Skeleton className="h-4 w-3/4 rounded-pill" />
      </View>
      <Skeleton className="h-[84px] w-full rounded-card" />
      <Skeleton className="h-[84px] w-full rounded-card" />
      <Skeleton className="h-[84px] w-full rounded-card" />
    </View>
  );
}
