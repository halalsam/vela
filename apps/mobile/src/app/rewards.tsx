import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { BalanceCard, FriendsList, HowItWorks, InviteCard } from '@/components/sections/rewards/RewardsSections';
import { CardSkeleton, EmptyState, ErrorState, OfflineBanner } from '@/components/sections/states/StateViews';
import { useRewards } from '@/queries';

export default function RewardsScreen() {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useRewards();
  return (
    <ScrollView className="flex-1 bg-canvas" contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-section px-gutter pb-24 pt-2">
      <Stack.Screen options={{ title: t('rewards.title') }} />
      <OfflineBanner />
      {isPending ? (
        <CardSkeleton />
      ) : isError || !data ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <>
          <BalanceCard rewards={data} />
          <InviteCard code={data.code} />
          {data.referrals.length > 0 ? (
            <FriendsList rewards={data} />
          ) : (
            <EmptyState icon="gift" title={t('rewards.emptyTitle')} body={t('rewards.emptyBody')} />
          )}
          <HowItWorks />
        </>
      )}
    </ScrollView>
  );
}
