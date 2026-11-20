'use client';

import { priceBreakdown, type Coupon, type Currency } from '@vela/api';
import { formatPrice } from '@vela/utils';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Flag, FlagStack } from '@/components/esim';
import { Button, Card, Field } from '@/components/ui';
import { browserApi } from '@/lib/browserApi';
import { format, type Dictionary } from '@/lib/i18n';
import { saveOrder } from '@/lib/orders';
import { cn, type } from '@/lib/type';

export type CheckoutPlan = {
  id: string;
  title: string;
  days: string;
  price: number;
  currency: Currency;
  codes: string[];
  isRegion: boolean;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CheckoutForm({ plan, labels, successBase }: { plan: CheckoutPlan; labels: Dictionary['checkout']; successBase: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [paying, setPaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const totals = priceBreakdown(plan.price, coupon);
  const money = (amount: number) => formatPrice(amount, plan.currency);

  async function apply() {
    setApplying(true);
    setCouponError(null);
    try {
      setCoupon(await browserApi.redeemCoupon(code));
    } catch {
      setCouponError(labels.couponInvalid);
    } finally {
      setApplying(false);
    }
  }

  async function pay(event: FormEvent) {
    event.preventDefault();
    if (!EMAIL.test(email)) {
      setEmailError(labels.emailInvalid);
      return;
    }
    setEmailError(null);
    setFailed(false);
    setPaying(true);
    try {
      const order = await browserApi.createOrder({ planId: plan.id, couponCode: coupon?.code ?? null });
      const esim = await browserApi.getEsim(order.iccid);
      saveOrder({ order, esim, title: plan.title });
      router.push(`${successBase}?order=${order.order_id}`);
    } catch {
      setFailed(true);
      setPaying(false);
    }
  }

  return (
    <form onSubmit={pay} noValidate className="grid gap-8 md:grid-cols-[1fr_0.9fr]">
      <div className="flex flex-col gap-6">
        <Card className="flex items-center gap-4 p-section">
          {plan.isRegion ? <FlagStack codes={plan.codes} size="lg" /> : <Flag code={plan.codes[0] ?? ''} size="lg" />}
          <div className="flex-1">
            <p className={type.title}>{plan.title}</p>
            <p className={cn(type.caption, 'text-fg-tertiary')}>
              {plan.days} · {labels.startsWhenLand}
            </p>
          </div>
          <span dir="ltr" className={type.dataSm}>
            {money(plan.price)}
          </span>
        </Card>
        <Field
          label={labels.email}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={labels.emailPlaceholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={emailError}
        />
        {coupon ? (
          <Card className="flex items-center justify-between gap-3 px-section py-3">
            <span className={cn(type.calloutStrong, 'text-accent')}>{format(labels.applied, { code: coupon.code })}</span>
            <Button variant="ghost" size="sm" onClick={() => setCoupon(null)}>
              {labels.remove}
            </Button>
          </Card>
        ) : (
          <div className="flex items-start gap-2">
            <Field
              className="flex-1"
              label={labels.coupon}
              name="coupon"
              autoCapitalize="characters"
              placeholder={labels.couponPlaceholder}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              error={couponError}
            />
            <Button variant="secondary" className="mt-[30px]" disabled={!code.trim() || applying} onClick={() => void apply()}>
              {labels.apply}
            </Button>
          </div>
        )}
        <p className={cn(type.caption, 'text-fg-tertiary')}>{labels.demo}</p>
      </div>
      <Card className="flex flex-col gap-3 self-start p-section md:sticky md:top-24">
        <h2 className={cn(type.label, 'text-fg-tertiary')}>{labels.summary}</h2>
        <Row label={labels.subtotal} value={money(totals.subtotal)} />
        {totals.discount > 0 ? <Row label={labels.discount} value={`−${money(totals.discount)}`} accent /> : null}
        <Row label={labels.gst} value={money(totals.tax)} />
        <div className="mt-2 flex items-center justify-between border-t border-line pt-4">
          <span className={type.title}>{labels.total}</span>
          <span dir="ltr" className={type.dataMd}>
            {money(totals.total)}
          </span>
        </div>
        {failed ? (
          <p role="alert" className={cn(type.callout, 'rounded-button bg-danger-tint px-4 py-3 text-danger')}>
            {labels.failed}
          </p>
        ) : null}
        <Button type="submit" fullWidth disabled={paying} aria-busy={paying} className="mt-2">
          {paying ? labels.paying : format(labels.pay, { amount: money(totals.total) })}
        </Button>
      </Card>
    </form>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className={cn(type.callout, 'text-fg-secondary')}>{label}</span>
      <span dir="ltr" className={cn(type.callout, 'tabular-nums', accent ? 'text-accent' : 'text-fg-secondary')}>
        {value}
      </span>
    </div>
  );
}
