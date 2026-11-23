'use client';

import { priceBreakdown, type Coupon, type Currency, type Order } from '@vela/api';
import { colors } from '@vela/tokens';
import { formatPrice } from '@vela/utils';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { Flag, FlagStack } from '@/components/esim';
import { Button, ButtonLink, Card, Field } from '@/components/ui';
import { authClient } from '@/lib/authClient';
import { browserApi } from '@/lib/browserApi';
import { format, type Dictionary } from '@/lib/i18n';
import { saveOrder } from '@/lib/orders';
import { collectWebPayment, PaymentCancelled } from '@/lib/razorpay';
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
const POLL_MS = 2000;
const GIVE_UP_MS = 90_000;

class Refunded extends Error {}
class StillWorking extends Error {}

function attemptKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function waitForEsim(order: Order): Promise<Order> {
  const started = Date.now();
  let current = order;
  while (!current.iccid) {
    if (current.status === 'provisioning_failed' || current.status === 'refunded') throw new Refunded();
    if (Date.now() - started > GIVE_UP_MS) throw new StillWorking();
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    current = await browserApi.getOrder(current.order_id);
  }
  return current;
}

type CheckoutProps = { plan: CheckoutPlan; labels: Dictionary['checkout']; successBase: string; accountHref: string };

export function CheckoutForm(props: CheckoutProps) {
  return authClient ? <LiveGate {...props} /> : <CheckoutFields {...props} live={false} />;
}

function LiveGate(props: CheckoutProps) {
  const session = authClient?.useSession();
  if (!session || session.isPending) return <div className="h-80" aria-busy />;
  if (!session.data) {
    return (
      <Card className="flex max-w-md flex-col items-start gap-4 p-section">
        <h2 className={type.displayMd}>{props.labels.signInTitle}</h2>
        <p className={cn(type.callout, 'text-fg-secondary')}>{props.labels.signInBody}</p>
        <ButtonLink href={props.accountHref}>{props.labels.signIn}</ButtonLink>
      </Card>
    );
  }
  const email = session.data.user.email;
  return <CheckoutFields {...props} live initialEmail={email.endsWith('@phone.vela.invalid') ? '' : email} />;
}

function CheckoutFields({ plan, labels, successBase, live, initialEmail = '' }: CheckoutProps & { live: boolean; initialEmail?: string }) {
  const router = useRouter();
  const attempt = useRef(attemptKey());
  const [email, setEmail] = useState(initialEmail);
  const [notice, setNotice] = useState<string | null>(null);
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
      attempt.current = attemptKey();
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
    setNotice(null);
    setPaying(true);
    try {
      const checkout = await browserApi.createOrder({ planId: plan.id, couponCode: coupon?.code ?? null, idempotencyKey: attempt.current });
      const result = await collectWebPayment(checkout, {
        email,
        description: format(labels.description, { plan: plan.title }),
        color: colors.accent.DEFAULT,
      });
      const confirmed = result ? await browserApi.confirmPayment(checkout.order.order_id, result) : checkout.order;
      if (live) setNotice(labels.waiting);
      const order = await waitForEsim(confirmed);
      const esim = await browserApi.getEsim(order.iccid ?? '');
      saveOrder({ order, esim, title: plan.title });
      router.push(`${successBase}?order=${order.order_id}`);
    } catch (error) {
      setPaying(false);
      if (error instanceof PaymentCancelled) return;
      if (error instanceof Refunded) setNotice(labels.refunded);
      else if (error instanceof StillWorking) setNotice(labels.slow);
      else {
        setNotice(null);
        setFailed(true);
      }
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCoupon(null);
                attempt.current = attemptKey();
              }}
            >
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
        <p className={cn(type.caption, 'text-fg-tertiary')}>{live ? labels.live : labels.demo}</p>
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
        {notice ? (
          <p role="status" className={cn(type.callout, 'rounded-button bg-surface-1 px-4 py-3 text-fg-secondary')}>
            {notice}
          </p>
        ) : null}
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
