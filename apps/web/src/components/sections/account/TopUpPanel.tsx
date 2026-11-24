'use client';

import type { Order, TopUpPack } from '@vela/api';
import { colors } from '@vela/tokens';
import { formatData, formatPrice } from '@vela/utils';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { browserApi } from '@/lib/browserApi';
import { format, type Dictionary } from '@/lib/i18n';
import { collectWebPayment, PaymentCancelled } from '@/lib/razorpay';
import { cn, type } from '@/lib/type';

const POLL_MS = 1500;
const GIVE_UP_MS = 60_000;

type Labels = Dictionary['account'];
type Phase = { step: 'closed' } | { step: 'loading' } | { step: 'choose'; packs: TopUpPack[] } | { step: 'paying'; packs: TopUpPack[] } | { step: 'done'; message: string };

function attemptKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function untilFulfilled(order: Order): Promise<'fulfilled' | 'pending' | 'failed'> {
  const started = Date.now();
  let current = order;
  while (current.status !== 'fulfilled') {
    if (current.status === 'provisioning_failed' || current.status === 'refunded') return 'failed';
    if (Date.now() - started > GIVE_UP_MS) return 'pending';
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    current = await browserApi.getOrder(current.order_id);
  }
  return 'fulfilled';
}

export function TopUpPanel({ iccid, labels, onToppedUp }: { iccid: string; labels: Labels; onToppedUp: () => void }) {
  const [phase, setPhase] = useState<Phase>({ step: 'closed' });
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef(attemptKey());

  async function open() {
    setError(null);
    setPhase({ step: 'loading' });
    try {
      const packs = await browserApi.getTopUpPacks(iccid);
      setSelected(packs[1]?.id ?? packs[0]?.id ?? null);
      setPhase(packs.length > 0 ? { step: 'choose', packs } : { step: 'done', message: labels.topUpNone });
    } catch {
      setPhase({ step: 'closed' });
      setError(labels.topUpFailed);
    }
  }

  async function pay(packs: TopUpPack[]) {
    const pack = packs.find((item) => item.id === selected);
    if (!pack) return;
    setError(null);
    setPhase({ step: 'paying', packs });
    try {
      const checkout = await browserApi.topUp({ iccid, packId: pack.id, idempotencyKey: attempt.current });
      const result = await collectWebPayment(checkout, {
        email: '',
        description: format(labels.topUpDescription, { data: formatData(pack.data_mb) }),
        color: colors.accent.DEFAULT,
      });
      const paid = result ? await browserApi.confirmPayment(checkout.order.order_id, result) : checkout.order;
      const outcome = await untilFulfilled(paid);
      attempt.current = attemptKey();
      if (outcome === 'failed') {
        setPhase({ step: 'choose', packs });
        setError(labels.topUpRefunded);
        return;
      }
      setPhase({ step: 'done', message: outcome === 'fulfilled' ? format(labels.topUpDone, { data: formatData(pack.data_mb) }) : labels.topUpPending });
      onToppedUp();
    } catch (caught) {
      setPhase({ step: 'choose', packs });
      if (!(caught instanceof PaymentCancelled)) setError(labels.topUpFailed);
    }
  }

  if (phase.step === 'closed' || phase.step === 'loading') {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button variant="secondary" size="sm" disabled={phase.step === 'loading'} aria-busy={phase.step === 'loading'} onClick={() => void open()}>
          {labels.topUp}
        </Button>
        {error ? (
          <p role="alert" className={cn(type.caption, 'text-danger')}>
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (phase.step === 'done') {
    return (
      <p role="status" className={cn(type.callout, 'text-accent')}>
        {phase.message}
      </p>
    );
  }

  const busy = phase.step === 'paying';
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <fieldset className="flex flex-col gap-2" disabled={busy}>
        <legend className={cn(type.label, 'mb-2 text-fg-tertiary')}>{labels.topUpChoose}</legend>
        {phase.packs.map((pack) => (
          <label
            key={pack.id}
            className={cn(
              'flex cursor-pointer items-center justify-between gap-3 rounded-button border px-4 py-3',
              pack.id === selected ? 'border-fg bg-surface-2' : 'border-line hover:border-line-strong',
            )}
          >
            <input type="radio" name={`topup-${iccid}`} value={pack.id} checked={pack.id === selected} onChange={() => setSelected(pack.id)} className="sr-only" />
            <span className={type.bodyStrong}>
              {formatData(pack.data_mb)}
              {pack.extra_days > 0 ? <span className={cn(type.caption, 'ms-2 text-fg-tertiary')}>{format(labels.topUpDays, { count: pack.extra_days })}</span> : null}
            </span>
            <span dir="ltr" className={type.dataSm}>
              {formatPrice(pack.price, pack.currency)}
            </span>
          </label>
        ))}
      </fieldset>
      {error ? (
        <p role="alert" className={cn(type.caption, 'text-danger')}>
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !selected} aria-busy={busy} onClick={() => void pay(phase.packs)}>
          {busy ? labels.topUpPaying : labels.topUpPay}
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => setPhase({ step: 'closed' })}>
          {labels.topUpCancel}
        </Button>
      </div>
    </div>
  );
}
