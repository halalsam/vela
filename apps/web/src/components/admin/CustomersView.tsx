'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Button, Card, Field, Pill } from '@/components/ui';
import {
  ACTIVITIES,
  adminFetch,
  conversationLabel,
  conversationTone,
  filterParams,
  money,
  personName,
  spendLabel,
  statusTone,
  when,
  type Activity,
  type AdminConversation,
  type AdminCustomer,
  type AdminCustomerRow,
  type CustomerFilter,
} from '@/lib/adminApi';
import { cn, type } from '@/lib/type';
import { useStaffRole } from './AdminShell';
import { Empty, ErrorNote, Row, Section, Select, Skeleton, Stat, TextArea, usePolled } from './kit';

type TagCount = { tag: string; customers: number };

/** The filters shared by the customer list and broadcasts. */
export function SegmentFields({ value, onChange, tags }: { value: CustomerFilter; onChange: (next: CustomerFilter) => void; tags: TagCount[] }) {
  return (
    <>
      <Select label="Activity" value={value.activity ?? ''} onChange={(event) => onChange({ ...value, activity: (event.target.value || undefined) as Activity | undefined })}>
        <option value="">Anyone</option>
        {Object.entries(ACTIVITIES).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </Select>
      <Select label="Tag" value={value.tag ?? ''} onChange={(event) => onChange({ ...value, tag: event.target.value || undefined })}>
        <option value="">Any tag</option>
        {tags.map((item) => (
          <option key={item.tag} value={item.tag}>
            {item.tag} ({item.customers})
          </option>
        ))}
      </Select>
      <Select label="Language" value={value.language ?? ''} onChange={(event) => onChange({ ...value, language: (event.target.value || undefined) as 'en' | 'ar' | undefined })}>
        <option value="">Any language</option>
        <option value="en">English</option>
        <option value="ar">Arabic</option>
      </Select>
      <Field
        label="Bought for country"
        name="country"
        placeholder="JP"
        maxLength={2}
        className="w-36"
        value={value.country ?? ''}
        onChange={(event) => onChange({ ...value, country: event.target.value.toUpperCase() || undefined })}
      />
    </>
  );
}

export function CustomersView() {
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<CustomerFilter>({});
  const tags = usePolled<TagCount[]>('/v1/admin/tags');
  const params = new URLSearchParams({ limit: '100', ...filterParams(filter) }).toString();
  const list = usePolled<{ total: number; customers: AdminCustomerRow[] }>(`/v1/admin/customers?${params}`);
  const country = filter.country && filter.country.length !== 2 ? 'Use a 2-letter code like JP' : null;

  function search(event: FormEvent) {
    event.preventDefault();
    setFilter((current) => ({ ...current, q: draft.trim() || undefined }));
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className={type.displayLg}>customers</h1>
        {list.data ? <span className={cn(type.callout, 'text-fg-secondary')}>{list.data.total.toLocaleString('en-IN')} matching</span> : null}
      </div>
      <form onSubmit={search} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <Field className="flex-1" label="Search" name="q" placeholder="Name, phone, email, order number or ICCID" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <Button type="submit">Search</Button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <SegmentFields
            value={filter}
            tags={tags.data ?? []}
            onChange={(next) => setFilter(next.country && next.country.length !== 2 ? { ...next } : next)}
          />
          {Object.keys(filterParams(filter)).length > 0 ? (
            <Button
              variant="ghost"
              onClick={() => {
                setDraft('');
                setFilter({});
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
        {country ? <p className={cn(type.caption, 'text-warning')}>{country}</p> : null}
      </form>
      {list.error ? (
        <ErrorNote>{list.error}</ErrorNote>
      ) : list.data === null ? (
        <Skeleton />
      ) : list.data.customers.length === 0 ? (
        <Empty>No customers match.</Empty>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-start">
            <thead>
              <tr className={cn(type.labelSm, 'text-fg-tertiary')}>
                {['Customer', 'Tags', 'Orders', 'Spent', 'Last order', 'Support', 'Joined'].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3 text-start font-normal">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data.customers.map((row) => (
                <tr key={row.user_id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link href={`/admin/customers/${encodeURIComponent(row.user_id)}`} className="flex flex-col hover:underline">
                      <span className={cn(type.calloutStrong, 'text-accent')}>{personName(row)}</span>
                      <span className={cn(type.caption, 'text-fg-tertiary')}>{[row.phone, row.email].filter(Boolean).join(' · ')}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap gap-1">
                      {row.tags.map((tag) => (
                        <Pill key={tag}>{tag}</Pill>
                      ))}
                    </span>
                  </td>
                  <td className={cn(type.callout, 'px-4 py-3 tabular-nums')}>{row.orders}</td>
                  <td className={cn(type.callout, 'px-4 py-3 tabular-nums')}>{spendLabel(row.spend)}</td>
                  <td className={cn(type.caption, 'px-4 py-3 text-fg-tertiary')}>{row.last_order_at ? when(row.last_order_at) : 'Never'}</td>
                  <td className="px-4 py-3">{row.conversation ? <Pill tone={conversationTone[row.conversation]}>{conversationLabel[row.conversation]}</Pill> : null}</td>
                  <td className={cn(type.caption, 'px-4 py-3 text-fg-tertiary')}>{new Date(row.joined_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

function TagEditor({ userId, tags, onSaved }: { userId: string; tags: string[]; onSaved: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: string[]) {
    setBusy(true);
    setError(null);
    try {
      const result = await adminFetch<{ tags: string[] }>(`/v1/admin/customers/${encodeURIComponent(userId)}/tags`, { method: 'PUT', body: { tags: next } });
      onSaved(result.tags);
      setDraft('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t save tags');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 ? <span className={cn(type.caption, 'text-fg-tertiary')}>No tags.</span> : null}
        {tags.map((tag) => (
          <span key={tag} className={cn(type.caption, 'inline-flex h-7 items-center gap-1 rounded-chip bg-surface-3 ps-2.5 pe-1 text-fg-secondary')}>
            {tag}
            <button
              type="button"
              disabled={busy}
              aria-label={`Remove tag ${tag}`}
              onClick={() => void save(tags.filter((item) => item !== tag))}
              className="inline-flex h-5 w-5 items-center justify-center rounded-pill hover:bg-surface-2 hover:text-fg"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) void save([...tags, draft.trim()]);
        }}
      >
        <input
          aria-label="Add a tag"
          value={draft}
          maxLength={30}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a tag, e.g. vip"
          className={cn(type.callout, 'h-button-compact flex-1 rounded-button border border-line bg-surface-1 px-3 text-fg outline-none placeholder:text-fg-tertiary focus:border-fg-tertiary')}
        />
        <Button type="submit" size="sm" variant="secondary" disabled={busy || !draft.trim()}>
          Add
        </Button>
      </form>
      {error ? <p className={cn(type.caption, 'text-danger')}>{error}</p> : null}
    </div>
  );
}

function CreditForm({ userId, currency, onDone }: { userId: string; currency: string; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState(['INR', 'AED', 'SAR', 'EUR', 'USD'].includes(currency) ? currency : 'INR');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const value = Number(amount);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!value || reason.trim().length < 3) return;
    if (!window.confirm(`${value > 0 ? 'Add' : 'Remove'} ${money(Math.abs(value), unit)} of travel credit?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      await adminFetch(`/v1/admin/users/${encodeURIComponent(userId)}/credit`, { method: 'POST', body: { amount: value, currency: unit, reason: reason.trim() } });
      setAmount('');
      setReason('');
      setMessage({ tone: 'ok', text: 'Credit updated.' });
      onDone();
    } catch (caught) {
      setMessage({ tone: 'error', text: caught instanceof Error ? caught.message : 'Couldn’t add credit' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Field label="Amount" name="amount" type="number" step="0.01" className="flex-1" value={amount} onChange={(event) => setAmount(event.target.value)} hint="Negative to remove" />
        <Select label="Currency" value={unit} onChange={(event) => setUnit(event.target.value)}>
          {['INR', 'AED', 'SAR', 'EUR', 'USD'].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Select>
      </div>
      <Field label="Reason" name="reason" placeholder="Slow install, goodwill" value={reason} onChange={(event) => setReason(event.target.value)} />
      <Button type="submit" variant="secondary" disabled={busy || !value || reason.trim().length < 3}>
        Update credit
      </Button>
      {message ? <p className={cn(type.caption, message.tone === 'ok' ? 'text-success' : 'text-danger')}>{message.text}</p> : null}
    </form>
  );
}

function SupportChats({ customer }: { customer: AdminCustomer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [iccid, setIccid] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const chat = await adminFetch<AdminConversation>(`/v1/admin/customers/${encodeURIComponent(customer.user_id)}/conversations`, {
        method: 'POST',
        body: { text: text.trim(), iccid: iccid || null },
      });
      router.push(`/admin/inbox?c=${encodeURIComponent(chat.id)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Couldn’t start the chat');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {customer.conversations.length === 0 ? (
        <p className={cn(type.callout, 'text-fg-secondary')}>No chats yet.</p>
      ) : (
        <dl>
          {customer.conversations.map((item) => (
            <Row
              key={item.id}
              label={
                <Link href={`/admin/inbox?c=${encodeURIComponent(item.id)}`} className="flex flex-col hover:underline">
                  <span className={cn(type.calloutStrong, 'text-accent')}>#{item.number}</span>
                  <span className={cn(type.caption, 'text-fg-tertiary')}>
                    {item.esim?.label ?? 'No plan'} · {when(item.last_message_at)}
                  </span>
                </Link>
              }
            >
              <Pill tone={conversationTone[item.status]}>{conversationLabel[item.status]}</Pill>
            </Row>
          ))}
        </dl>
      )}
      {open ? (
        <form onSubmit={start} className="flex flex-col gap-3 border-t border-line pt-3">
          <Select label="About plan (optional)" value={iccid} onChange={(event) => setIccid(event.target.value)}>
            <option value="">No plan</option>
            {customer.esims.map((item) => (
              <option key={item.iccid} value={item.iccid}>
                {item.label} · …{item.iccid.slice(-4)}
              </option>
            ))}
          </Select>
          <TextArea label="First message" rows={3} maxLength={2000} dir="auto" value={text} onChange={(event) => setText(event.target.value)} hint="The customer gets a push and sees it as a new chat." />
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !text.trim()}>
              Send and open chat
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setOpen(true)}>
          New chat
        </Button>
      )}
    </div>
  );
}

function Lines({ items, empty, children }: { items: unknown[]; empty: string; children: ReactNode }) {
  return items.length === 0 ? <p className={cn(type.callout, 'text-fg-secondary')}>{empty}</p> : <dl>{children}</dl>;
}

export function CustomerView({ id }: { id: string }) {
  const role = useStaffRole();
  const { data: customer, error, reload } = usePolled<AdminCustomer>(`/v1/admin/customers/${encodeURIComponent(id)}`);

  if (!customer) return error ? <ErrorNote>{error}</ErrorNote> : <Skeleton className="h-80" />;

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link href="/admin/customers" className={cn(type.callout, 'text-fg-secondary hover:text-fg')}>
          ← Customers
        </Link>
        <h1 className={type.displayLg}>{personName(customer).toLowerCase()}</h1>
      </div>
      <div className="grid grid-cols-2 gap-card-gap md:grid-cols-4">
        <Stat label="Orders" value={customer.orders_count} />
        <Stat label="Spent" value={spendLabel(customer.spend)} />
        <Stat label="Travel credit" value={customer.credit.length ? customer.credit.map((item) => money(item.amount, item.currency)).join(' + ') : 'None'} />
        <Stat label="Referrals" value={customer.referrals} hint={`Code ${customer.referral_code}`} />
      </div>
      <div className="grid gap-card-gap lg:grid-cols-3">
        <Section title="Contact">
          <dl>
            <Row label="Name">{customer.name ?? 'Not given'}</Row>
            <Row label="Phone">{customer.phone ?? 'Not given'}</Row>
            <Row label="Email">
              <span className="break-all">{customer.email ?? 'Not given'}</span>
            </Row>
            <Row label="Language">{customer.language.startsWith('ar') ? 'Arabic' : 'English'}</Row>
            <Row label="Currency">{customer.currency}</Row>
            <Row label="Joined">{when(customer.joined_at)}</Row>
            {customer.referred_by ? <Row label="Referred by">{customer.referred_by}</Row> : null}
            <Row label="User ID">
              <span className={type.caption}>{customer.user_id}</span>
            </Row>
          </dl>
        </Section>
        <Section title="Tags">
          <TagEditor userId={customer.user_id} tags={customer.tags} onSaved={() => reload()} />
        </Section>
        <Section title="Devices">
          <Lines items={customer.devices} empty="No devices. Pushes can’t reach this customer.">
            {customer.devices.map((item, index) => (
              <Row key={`${item.platform}-${index}`} label={item.platform === 'ios' ? 'iPhone' : item.platform === 'android' ? 'Android' : item.platform}>
                <span className={type.caption}>Seen {when(item.last_seen_at)}</span>
              </Row>
            ))}
          </Lines>
        </Section>
      </div>
      <Section title="Support chats">
        <SupportChats customer={customer} />
      </Section>
      <Section title="eSIMs">
        <Lines items={customer.esims} empty="No eSIMs yet.">
          {customer.esims.map((item) => (
            <Row
              key={item.iccid}
              label={
                <span className="flex flex-col">
                  <span>{item.label}</span>
                  <span className={cn(type.caption, 'text-fg-tertiary')}>{item.iccid}</span>
                </span>
              }
            >
              <span className="flex flex-col items-end gap-1">
                <Pill tone={item.status === 'active' ? 'success' : item.status === 'not_started' ? 'accent' : 'neutral'}>{item.status.replace(/_/g, ' ')}</Pill>
                <span className={cn(type.caption, 'text-fg-tertiary')}>
                  {Math.round(item.data_used_mb)} of {item.data_total_mb} MB{item.expires_at ? ` · ends ${when(item.expires_at)}` : ''}
                </span>
              </span>
            </Row>
          ))}
        </Lines>
      </Section>
      <Section title="Orders">
        <Lines items={customer.orders} empty="No orders yet.">
          {customer.orders.map((item) => (
            <Row
              key={item.order_id}
              label={
                <Link href={`/admin/orders/${item.order_id}`} className="flex flex-col hover:underline">
                  <span className={cn(type.calloutStrong, 'text-accent')}>{item.number}</span>
                  <span className={cn(type.caption, 'text-fg-tertiary')}>
                    {item.kind === 'top_up' ? 'Top-up · ' : ''}
                    {item.plan_id} · {when(item.created_at)}
                  </span>
                </Link>
              }
            >
              <span className="flex flex-col items-end gap-1">
                <span>{money(item.total, item.currency)}</span>
                <Pill tone={statusTone[item.status] ?? 'neutral'}>{item.status.replace(/_/g, ' ')}</Pill>
              </span>
            </Row>
          ))}
        </Lines>
      </Section>
      <div className="grid gap-card-gap lg:grid-cols-2">
        {role === 'admin' ? (
          <Section title="Travel credit">
            <CreditForm userId={customer.user_id} currency={customer.currency} onDone={() => reload()} />
          </Section>
        ) : null}
        <Section title="Support ratings">
          <Lines items={customer.ratings} empty="No ratings yet.">
            {customer.ratings.map((item) => (
              <Row key={item.at} label={<span title={`${item.score} of 5`}>{'★'.repeat(item.score)}{'☆'.repeat(5 - item.score)}</span>}>
                <span className="flex flex-col items-end">
                  {item.comment ? <span className={type.caption}>“{item.comment}”</span> : null}
                  <span className={cn(type.caption, 'text-fg-tertiary')}>{when(item.at)}</span>
                </span>
              </Row>
            ))}
          </Lines>
        </Section>
      </div>
      {customer.history.length > 0 ? (
        <Section title="Staff actions">
          <dl>
            {customer.history.map((item) => (
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
