'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Field, Pill } from '@/components/ui';
import { adminFetch, money, when, type AdminCoupon } from '@/lib/adminApi';
import { cn, type } from '@/lib/type';
import { useStaffRole } from './AdminShell';

const empty = { code: '', kind: 'percent' as 'percent' | 'amount', value: '', max: '', countries: '', ends: '' };

function isLive(item: AdminCoupon): boolean {
  const now = Date.now();
  if (item.ends_at && Date.parse(item.ends_at) < now) return false;
  if (item.starts_at && Date.parse(item.starts_at) > now) return false;
  return item.max_redemptions === null || item.redemptions < item.max_redemptions;
}

export function CouponsView() {
  const role = useStaffRole();
  const [coupons, setCoupons] = useState<AdminCoupon[] | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setCoupons(await adminFetch<AdminCoupon[]>('/v1/admin/coupons'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t load coupons');
    }
  }

  useEffect(() => {
    let cancelled = false;
    adminFetch<AdminCoupon[]>('/v1/admin/coupons').then(
      (data) => !cancelled && setCoupons(data),
      (caught: unknown) => !cancelled && setError(caught instanceof Error ? caught.message : 'Couldn’t load coupons'),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminFetch('/v1/admin/coupons', {
        method: 'POST',
        body: {
          code: form.code.trim(),
          kind: form.kind,
          value: Number(form.value),
          currency: form.kind === 'amount' ? 'INR' : null,
          max_redemptions: form.max ? Number(form.max) : null,
          country_codes: form.countries
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          ends_at: form.ends ? new Date(`${form.ends}T23:59:59+05:30`).toISOString() : null,
        },
      });
      setForm(empty);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t create the coupon');
    } finally {
      setBusy(false);
    }
  }

  async function end(code: string) {
    if (!window.confirm(`End ${code} now? Customers won’t be able to use it.`)) return;
    try {
      await adminFetch(`/v1/admin/coupons/${encodeURIComponent(code)}`, { method: 'PATCH', body: { ends_at: new Date().toISOString() } });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t end the coupon');
    }
  }

  return (
    <>
      <h1 className={type.displayLg}>coupons</h1>
      {error ? (
        <p role="alert" className={cn(type.callout, 'rounded-button bg-danger-tint px-4 py-3 text-danger')}>
          {error}
        </p>
      ) : null}
      {role === 'admin' ? (
        <Card className="p-section">
          <form onSubmit={(event) => void create(event)} className="grid gap-4 md:grid-cols-3">
            <Field label="Code" name="code" autoCapitalize="characters" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
            <label className="flex flex-col gap-2">
              <span className={cn(type.calloutStrong, 'text-fg-secondary')}>Type</span>
              <select
                className={cn(type.body, 'h-button rounded-button border border-line bg-surface-1 px-4 text-fg')}
                value={form.kind}
                onChange={(event) => setForm({ ...form, kind: event.target.value as 'percent' | 'amount' })}
              >
                <option value="percent">Percent off</option>
                <option value="amount">Rupees off</option>
              </select>
            </label>
            <Field
              label={form.kind === 'percent' ? 'Percent' : 'Amount (INR)'}
              name="value"
              inputMode="decimal"
              value={form.value}
              onChange={(event) => setForm({ ...form, value: event.target.value })}
            />
            <Field label="Total uses (blank = no limit)" name="max" inputMode="numeric" value={form.max} onChange={(event) => setForm({ ...form, max: event.target.value })} />
            <Field
              label="Countries (blank = all)"
              name="countries"
              placeholder="JP, TH"
              value={form.countries}
              onChange={(event) => setForm({ ...form, countries: event.target.value })}
            />
            <Field label="Last day (IST)" name="ends" type="date" value={form.ends} onChange={(event) => setForm({ ...form, ends: event.target.value })} />
            <div className="md:col-span-3">
              <Button type="submit" disabled={busy || form.code.trim().length < 3 || !(Number(form.value) > 0)}>
                Create coupon
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
      {coupons === null ? (
        <div className="h-60 animate-pulse rounded-card bg-surface-1 motion-reduce:animate-none" aria-busy />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className={cn(type.labelSm, 'text-fg-tertiary')}>
                {['Code', 'Discount', 'Used', 'Countries', 'Ends', ''].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3 text-start font-normal">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map((item) => (
                <tr key={item.code} className="border-t border-line">
                  <td className="px-4 py-3">
                    <span className={cn(type.calloutStrong, 'me-2')}>{item.code}</span>
                    <Pill tone={isLive(item) ? 'success' : 'neutral'}>{isLive(item) ? 'live' : 'ended'}</Pill>
                  </td>
                  <td className={cn(type.callout, 'px-4 py-3 tabular-nums')}>
                    {item.kind === 'percent' ? `${item.value}%` : money(item.value, item.currency ?? 'INR')}
                  </td>
                  <td className={cn(type.callout, 'px-4 py-3 tabular-nums text-fg-secondary')}>
                    {item.redemptions}
                    {item.max_redemptions ? ` / ${item.max_redemptions}` : ''}
                  </td>
                  <td className={cn(type.callout, 'px-4 py-3 text-fg-secondary')}>{item.country_codes.join(', ') || 'All'}</td>
                  <td className={cn(type.caption, 'px-4 py-3 text-fg-tertiary')}>{when(item.ends_at)}</td>
                  <td className="px-4 py-3 text-end">
                    {role === 'admin' && isLive(item) ? (
                      <Button size="sm" variant="ghost" onClick={() => void end(item.code)}>
                        End now
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
