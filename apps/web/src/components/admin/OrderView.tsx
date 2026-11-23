'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button, Card, Field, Pill } from '@/components/ui';
import { adminFetch, money, statusTone, when, type AdminOrder } from '@/lib/adminApi';
import { cn, type } from '@/lib/type';
import { useStaffRole } from './AdminShell';

const REFUNDABLE = ['paid', 'provisioning', 'fulfilled', 'provisioning_failed'];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-t border-line py-2 first:border-t-0">
      <dt className={cn(type.callout, 'text-fg-secondary')}>{label}</dt>
      <dd className={cn(type.callout, 'text-end tabular-nums')}>{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3 p-section">
      <h2 className={cn(type.label, 'text-fg-tertiary')}>{title}</h2>
      {children}
    </Card>
  );
}

export function OrderView({ id }: { id: string }) {
  const role = useStaffRole();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminFetch<AdminOrder>(`/v1/admin/orders/${id}`).then(
      (data) => !cancelled && setOrder(data),
      (caught: unknown) => !cancelled && setError(caught instanceof Error ? caught.message : 'Couldn’t load this order'),
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      setOrder(await adminFetch<AdminOrder>(path, { method: 'POST', body }));
      setReason('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That didn’t work');
    } finally {
      setBusy(false);
    }
  }

  function refund(event: FormEvent) {
    event.preventDefault();
    if (!order || reason.trim().length < 3) return;
    if (!window.confirm(`Refund ${money(order.total, order.currency)} for ${order.number}? This can’t be undone.`)) return;
    void act(`/v1/admin/orders/${id}/refund`, { reason: reason.trim() });
  }

  if (!order) {
    return error ? (
      <p role="alert" className={cn(type.callout, 'text-danger')}>
        {error}
      </p>
    ) : (
      <div className="h-80 animate-pulse rounded-card bg-surface-1 motion-reduce:animate-none" aria-busy />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/admin" className={cn(type.callout, 'text-fg-secondary hover:text-fg')}>
          ← Orders
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className={type.displayLg}>{order.number.toLowerCase()}</h1>
          <Pill tone={statusTone[order.status] ?? 'neutral'}>{order.status.replace(/_/g, ' ')}</Pill>
        </div>
        {order.failure_reason ? <p className={cn(type.callout, 'text-warning')}>{order.failure_reason}</p> : null}
      </div>
      {error ? (
        <p role="alert" className={cn(type.callout, 'rounded-button bg-danger-tint px-4 py-3 text-danger')}>
          {error}
        </p>
      ) : null}
      <div className="grid gap-card-gap md:grid-cols-2">
        <Section title="Amounts">
          <dl>
            <Row label="Item">
              {order.kind === 'top_up' ? `Top-up ${order.top_up_pack_id ?? ''}` : order.plan_id}
            </Row>
            <Row label="Price">{money(order.subtotal, order.currency)}</Row>
            {order.discount > 0 ? <Row label={`Discount ${order.coupon_code ?? order.referral_code ?? ''}`}>−{money(order.discount, order.currency)}</Row> : null}
            {order.credit > 0 ? <Row label="Travel credit">−{money(order.credit, order.currency)}</Row> : null}
            <Row label="GST included">{money(order.tax, order.currency)}</Row>
            <Row label="Total">{money(order.total, order.currency)}</Row>
          </dl>
        </Section>
        <Section title="Customer">
          <dl>
            <Row label="Name">{order.customer.name ?? '—'}</Row>
            <Row label="Phone">{order.customer.phone ?? '—'}</Row>
            <Row label="Email">{order.customer.email ?? '—'}</Row>
            <Row label="User ID">
              <span className={type.caption}>{order.customer.user_id}</span>
            </Row>
          </dl>
        </Section>
        <Section title="Timeline">
          <dl>
            <Row label="Created">{when(order.created_at)}</Row>
            <Row label="Paid">{when(order.paid_at)}</Row>
            <Row label="Fulfilled">{when(order.fulfilled_at)}</Row>
          </dl>
        </Section>
        <Section title="eSIM">
          {order.esim ? (
            <dl>
              <Row label="ICCID">{order.esim.iccid}</Row>
              <Row label="Status">{order.esim.status.replace(/_/g, ' ')}</Row>
              <Row label="Data">
                {Math.round(order.esim.data_used_mb)} of {order.esim.data_total_mb} MB
              </Row>
              <Row label="Ends">{when(order.esim.expires_at)}</Row>
            </dl>
          ) : (
            <p className={cn(type.callout, 'text-fg-secondary')}>No eSIM yet.</p>
          )}
        </Section>
        <Section title="Payments">
          {order.payments.length === 0 ? (
            <p className={cn(type.callout, 'text-fg-secondary')}>Paid without a payment (credit or free).</p>
          ) : (
            <dl>
              {order.payments.map((item) => (
                <Row key={item.provider_order_id} label={`${item.provider} · ${item.status}`}>
                  <span className="flex flex-col items-end">
                    <span>{money(item.amount, order.currency)}</span>
                    <span className={cn(type.caption, 'text-fg-tertiary')}>{item.provider_payment_id ?? item.provider_order_id}</span>
                  </span>
                </Row>
              ))}
            </dl>
          )}
        </Section>
        <Section title="Invoice">
          {order.invoice ? (
            <a href={order.invoice.url} target="_blank" rel="noreferrer" className={cn(type.calloutStrong, 'text-accent hover:underline')}>
              {order.invoice.number}
            </a>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className={cn(type.callout, 'text-fg-secondary')}>Not issued.</p>
              {order.status === 'fulfilled' && order.currency === 'INR' ? (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(`/v1/admin/orders/${id}/invoice`)}>
                  Issue invoice
                </Button>
              ) : null}
            </div>
          )}
        </Section>
      </div>
      {role === 'admin' && REFUNDABLE.includes(order.status) ? (
        <Card className="flex flex-col gap-4 p-section">
          <h2 className={cn(type.label, 'text-fg-tertiary')}>Refund</h2>
          <p className={cn(type.callout, 'text-fg-secondary')}>
            Refunds the full payment and any travel credit used. An installed eSIM keeps working until the provider side is cancelled.
          </p>
          <form onSubmit={refund} className="flex flex-col gap-3 md:flex-row md:items-end">
            <Field className="flex-1" label="Reason" name="reason" value={reason} onChange={(event) => setReason(event.target.value)} />
            <Button type="submit" variant="secondary" disabled={busy || reason.trim().length < 3}>
              Refund {money(order.total, order.currency)}
            </Button>
          </form>
        </Card>
      ) : null}
      {order.history.length > 0 ? (
        <Section title="Staff actions">
          <dl>
            {order.history.map((item) => (
              <Row key={`${item.action}-${item.at}`} label={item.action}>
                {when(item.at)}
              </Row>
            ))}
          </dl>
        </Section>
      ) : null}
    </>
  );
}
