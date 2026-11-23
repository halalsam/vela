import type { Coupon, Plan } from '@vela/api';
import { formatPrice } from '@vela/utils';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Flag, FlagStack, PriceOdometer } from '@/components/esim';
import { Button, Card, Icon, Input, Text } from '@/components/ui';
import { usePlanTitle } from '@/hooks/usePlanTitle';

export function OrderSummary({ plan }: { plan: Plan }) {
  const { t } = useTranslation();
  const planTitle = usePlanTitle();
  return (
    <Card padding="lg" className="gap-4">
      <View className="flex-row items-center gap-3">
        {plan.type === 'country' ? <Flag code={plan.country_codes[0] ?? ''} size="lg" /> : <FlagStack codes={plan.country_codes} />}
        <View className="flex-1">
          <Text variant="title" numberOfLines={1}>
            {planTitle(plan)}
          </Text>
          <Text variant="caption" tone="tertiary">
            {`${t('esim.days', { count: plan.validity_days })} · ${t('checkout.startsWhenLand')}`}
          </Text>
        </View>
        <Text variant="data-sm">{formatPrice(plan.price, plan.currency)}</Text>
      </View>
      <View className="flex-row items-center gap-2 border-t border-line pt-4">
        <Icon name="checkCircle" size={16} tone="success" />
        <Text variant="callout" tone="secondary">
          {t('country.compatibleTitle')}
        </Text>
      </View>
    </Card>
  );
}

type CouponFieldProps = {
  applied: Coupon | null;
  busy: boolean;
  error: string | null;
  onApply: (code: string) => void;
  onRemove: () => void;
};

export function CouponField({ applied, busy, error, onApply, onRemove }: CouponFieldProps) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  if (applied) {
    return (
      <Card className="flex-row items-center gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-chip bg-accent-tint">
          <Icon name="tag" size={15} tone="accent" />
        </View>
        <Text weight="medium" className="flex-1">
          {t('checkout.couponApplied', { code: applied.code })}
        </Text>
        <Button label={t('checkout.removeCoupon')} variant="ghost" size="sm" onPress={onRemove} />
      </Card>
    );
  }
  return (
    <View className="flex-row items-start gap-2">
      <Input
        className="flex-1"
        label={t('checkout.coupon')}
        leadingIcon="tag"
        placeholder={t('checkout.couponPlaceholder')}
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={setCode}
        error={error ?? undefined}
        returnKeyType="done"
        onSubmitEditing={() => code.trim() && onApply(code)}
      />
      <Button
        label={t('checkout.apply')}
        variant="secondary"
        loading={busy}
        disabled={!code.trim()}
        onPress={() => onApply(code)}
        className="mt-6"
      />
    </View>
  );
}

type TotalsProps = {
  currency: Plan['currency'];
  subtotal: number;
  discount: number;
  credit?: number;
  tax: number;
  total: number;
};

function Row({ label, value, tone = 'secondary' }: { label: string; value: string; tone?: 'secondary' | 'accent' }) {
  return (
    <View className="flex-row justify-between">
      <Text variant="callout" tone="secondary">
        {label}
      </Text>
      <Text variant="callout" tone={tone} className="tabular-nums">
        {value}
      </Text>
    </View>
  );
}

export function Totals({ currency, subtotal, discount, credit = 0, tax, total }: TotalsProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-2 px-1">
      <Row label={t('checkout.subtotal')} value={formatPrice(subtotal, currency)} />
      {discount > 0 ? <Row label={t('checkout.discount')} value={`−${formatPrice(discount, currency)}`} tone="accent" /> : null}
      {credit > 0 ? <Row label={t('checkout.credit')} value={`−${formatPrice(credit, currency)}`} tone="accent" /> : null}
      <Row label={t('checkout.gstIncluded')} value={formatPrice(tax, currency)} />
      <View className="mt-2 flex-row items-center justify-between border-t border-line pt-3">
        <Text variant="title">{t('checkout.total')}</Text>
        <PriceOdometer amount={total} currency={currency} variant="data-md" />
      </View>
    </View>
  );
}
