'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Field, Pill } from '@/components/ui';
import { adminFetch, money, statusTone, when, type AdminOrderRow } from '@/lib/adminApi';
import { cn, type } from '@/lib/type';

const STATUSES = ['', 'awaiting_payment', 'paid', 'provisioning', 'fulfilled', 'provisioning_failed', 'refunded', 'expired'];

export function OrdersView() {
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState({ q: '', status: '' });
  const [rows, setRows] = useState<AdminOrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: '100', ...(filter.q ? { q: filter.q } : {}), ...(filter.status ? { status: filter.status } : {}) });
    adminFetch<AdminOrderRow[]>(`/v1/admin/orders?${params}`).then(
      (data) => {
        if (cancelled) return;
        setRows(data);
        setError(null);
      },
      (caught: unknown) => !cancelled && setError(caught instanceof Error ? caught.message : 'Couldn’t load orders'),
    );
    return () => {
      cancelled = true;
    };
  }, [filter]);

  function search(event: FormEvent) {
    event.preventDefault();
    setRows(null);
    setFilter((current) => ({ ...current, q: draft.trim() }));
  }

  return (
    <>
      <h1 className={type.displayLg}>orders</h1>
      <form onSubmit={search} className="flex flex-col gap-3 md:flex-row md:items-end">
        <Field
          className="flex-1"
          label="Search"
          name="q"
          placeholder="Order number, phone, email or ICCID"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <label className="flex flex-col gap-2">
          <span className={cn(type.calloutStrong, 'text-fg-secondary')}>Status</span>
          <select
            className={cn(type.body, 'h-button rounded-button border border-line bg-surface-1 px-4 text-fg')}
            value={filter.status}
            onChange={(event) => {
              setRows(null);
              setFilter((current) => ({ ...current, status: event.target.value }));
            }}
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status ? status.replace(/_/g, ' ') : 'Any status'}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit">Search</Button>
      </form>
      {error ? (
        <p role="alert" className={cn(type.callout, 'text-danger')}>
          {error}
        </p>
      ) : rows === null ? (
        <div className="h-60 animate-pulse rounded-card bg-surface-1 motion-reduce:animate-none" aria-busy />
      ) : rows.length === 0 ? (
        <Card className="p-section">
          <p className={cn(type.callout, 'text-fg-secondary')}>No orders match.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-start">
            <thead>
              <tr className={cn(type.labelSm, 'text-fg-tertiary')}>
                {['Order', 'Customer', 'Item', 'Total', 'Status', 'Created'].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3 text-start font-normal">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.order_id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${row.order_id}`} className={cn(type.calloutStrong, 'text-accent hover:underline')}>
                      {row.number}
                    </Link>
                  </td>
                  <td className={cn(type.callout, 'px-4 py-3 text-fg-secondary')}>{row.customer.name ?? row.customer.phone ?? row.customer.email ?? '—'}</td>
                  <td className={cn(type.callout, 'px-4 py-3 text-fg-secondary')}>
                    {row.kind === 'top_up' ? 'Top-up · ' : ''}
                    {row.plan_id ?? '—'}
                  </td>
                  <td className={cn(type.callout, 'px-4 py-3 tabular-nums')}>{money(row.total, row.currency)}</td>
                  <td className="px-4 py-3">
                    <Pill tone={statusTone[row.status] ?? 'neutral'}>{row.status.replace(/_/g, ' ')}</Pill>
                  </td>
                  <td className={cn(type.caption, 'px-4 py-3 text-fg-tertiary')}>{when(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
