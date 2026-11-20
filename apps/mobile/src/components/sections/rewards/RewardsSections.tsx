import type { Rewards } from '@vela/api';
import { formatPrice } from '@vela/utils';
import { useTranslation } from 'react-i18next';
import { Share, View } from 'react-native';
import { PriceOdometer } from '@/components/esim';
import { Button, Card, ListGroup, ListRow, Pill, Text } from '@/components/ui';
import { useCopy } from '@/hooks/useCopy';

export function BalanceCard({ rewards }: { rewards: Rewards }) {
  const { t } = useTranslation();
  return (
    <Card padding="lg" className="flex-row items-end justify-between">
      <View className="gap-1">
        <Text variant="label" tone="tertiary">
          {t('rewards.balance')}
        </Text>
        <PriceOdometer amount={rewards.balance} currency={rewards.currency} variant="data-lg" tone="accent" />
      </View>
      <View className="items-end gap-1">
        <Text variant="label" tone="tertiary">
          {t('rewards.trips')}
        </Text>
        <Text variant="data-md">{rewards.trips}</Text>
      </View>
    </Card>
  );
}

export function InviteCard({ code }: { code: string }) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy();
  return (
    <Card padding="lg" className="gap-4">
      <Text variant="label" tone="tertiary">
        {t('rewards.yourCode')}
      </Text>
      <Text variant="data-md" selectable className="tracking-widest">
        {code}
      </Text>
      <View className="flex-row gap-3">
        <Button
          label={copied ? t('esim.copied') : t('common.copy')}
          icon={copied ? 'check' : 'copy'}
          variant="secondary"
          haptic={false}
          onPress={() => void copy(code)}
        />
        <View className="flex-1">
          <Button
            label={t('rewards.share')}
            icon="share"
            fullWidth
            onPress={() => void Share.share({ message: t('rewards.shareMessage', { code }) })}
          />
        </View>
      </View>
    </Card>
  );
}

const how = [
  ['rewards.how1', 'rewards.how1Body'],
  ['rewards.how2', 'rewards.how2Body'],
  ['rewards.how3', 'rewards.how3Body'],
] as const;

export function HowItWorks() {
  const { t } = useTranslation();
  return (
    <ListGroup header={t('rewards.howTitle')}>
      {how.map(([title, body], index) => (
        <ListRow
          key={title}
          leading={
            <View className="h-8 w-8 items-center justify-center rounded-pill bg-surface-3">
              <Text variant="callout" weight="semibold">
                {index + 1}
              </Text>
            </View>
          }
          title={t(title)}
          subtitle={t(body)}
        />
      ))}
    </ListGroup>
  );
}

export function FriendsList({ rewards }: { rewards: Rewards }) {
  const { t } = useTranslation();
  return (
    <ListGroup header={t('rewards.friends')}>
      {rewards.referrals.map((friend) => (
        <ListRow
          key={friend.id}
          leading={
            <View className="h-9 w-9 items-center justify-center rounded-pill bg-surface-3">
              <Text weight="semibold">{friend.name.charAt(0)}</Text>
            </View>
          }
          title={friend.name}
          trailing={
            friend.status === 'travelled' ? (
              <Pill label={`+${formatPrice(friend.reward, rewards.currency)}`} tone="accent" size="sm" />
            ) : (
              <Pill label={t('rewards.joined')} size="sm" />
            )
          }
        />
      ))}
    </ListGroup>
  );
}
