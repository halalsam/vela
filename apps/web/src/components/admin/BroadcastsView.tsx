'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button, Card, Field, Pill } from '@/components/ui';
import { adminFetch, describeSegment, filterParams, when, type AdminBroadcast, type CustomerFilter } from '@/lib/adminApi';
import { cn, type } from '@/lib/type';
import { useStaffRole } from './AdminShell';
import { SegmentFields } from './CustomersView';
import { Empty, ErrorNote, Section, Skeleton, TextArea, usePolled } from './kit';

const TITLE_MAX = 65;
const BODY_MAX = 178;

const statusTone = { queued: 'neutral', sending: 'accent', sent: 'success', failed: 'danger' } as const;

function Preview({ title, body, rtl }: { title: string; body: string; rtl?: boolean }) {
  return (
    <div dir={rtl ? 'rtl' : 'ltr'} className="flex gap-3 rounded-card-lg border border-line bg-surface-2 p-3">
      <span className={cn(type.labelSm, 'flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-fg text-fg-inverse')}>v</span>
      <span className="flex min-w-0 flex-col">
        <span className={cn(type.calloutStrong, 'truncate')}>{title || 'Title'}</span>
        <span className={cn(type.caption, 'line-clamp-3 text-fg-secondary')}>{body || 'Message'}</span>
      </span>
    </div>
  );
}

export function BroadcastsView() {
  const role = useStaffRole();
  const history = usePolled<AdminBroadcast[]>('/v1/admin/broadcasts', 10_000);
  const tags = usePolled<{ tag: string; customers: number }[]>('/v1/admin/tags');
  const [segment, setSegment] = useState<CustomerFilter>({});
  const [sized, setSized] = useState<{ key: string; customers: number; reachable: number } | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [arabic, setArabic] = useState(false);
  const [titleAr, setTitleAr] = useState('');
  const [bodyAr, setBodyAr] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const key = JSON.stringify(filterParams(segment));
  const audience = sized?.key === key ? sized : null;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      adminFetch<{ customers: number; reachable: number }>('/v1/admin/broadcasts/audience', { method: 'POST', body: { segment: JSON.parse(key) as CustomerFilter } }).then(
        (size) => !cancelled && setSized({ key, ...size }),
        () => undefined,
      );
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key]);

  const arabicIncomplete = arabic && (!titleAr.trim() || !bodyAr.trim());
  const ready = title.trim() && body.trim() && !arabicIncomplete && (audience?.reachable ?? 0) > 0;

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!ready || !audience) return;
    if (!window.confirm(`Send this push to ${audience.reachable.toLocaleString('en-IN')} customers now? It can’t be taken back.`)) return;
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      await adminFetch<AdminBroadcast>('/v1/admin/broadcasts', {
        method: 'POST',
        body: {
          title: title.trim(),
          body: body.trim(),
          title_ar: arabic ? titleAr.trim() : null,
          body_ar: arabic ? bodyAr.trim() : null,
          segment: filterParams(segment),
        },
      });
      setTitle('');
      setBody('');
      setTitleAr('');
      setBodyAr('');
      setNotice('Queued. Pushes go out over the next few minutes.');
      history.reload();
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : 'Couldn’t send');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className={type.displayLg}>broadcasts</h1>
        <p className={cn(type.callout, 'max-w-2xl text-fg-secondary')}>
          Send a push notification to a group of customers, like everyone whose plan ends soon. Only customers with the app and notifications on receive it.
        </p>
      </div>
      <form onSubmit={send} className="grid gap-card-gap lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-card-gap">
          <Section title="Who gets it">
            <div className="flex flex-wrap items-end gap-3">
              <SegmentFields value={segment} onChange={setSegment} tags={tags.data ?? []} />
            </div>
            <p className={cn(type.callout, 'text-fg-secondary')}>
              {describeSegment(segment)}:{' '}
              {audience ? (
                <>
                  <span className="font-sans-semibold text-fg">{audience.reachable.toLocaleString('en-IN')}</span> can get a push
                  {audience.customers !== audience.reachable ? ` (of ${audience.customers.toLocaleString('en-IN')} customers)` : ''}
                </>
              ) : (
                'counting…'
              )}
            </p>
          </Section>
          <Section title="Message">
            <Field label="Title" name="title" maxLength={TITLE_MAX} value={title} onChange={(event) => setTitle(event.target.value)} hint={`${title.length}/${TITLE_MAX}`} />
            <TextArea label="Text" rows={3} maxLength={BODY_MAX} value={body} onChange={(event) => setBody(event.target.value)} hint={`${body.length}/${BODY_MAX}`} />
            <label className={cn(type.callout, 'flex items-center gap-2 text-fg-secondary')}>
              <input type="checkbox" checked={arabic} onChange={(event) => setArabic(event.target.checked)} />
              Add an Arabic version for phones set to Arabic
            </label>
            {arabic ? (
              <div dir="rtl" className="flex flex-col gap-3">
                <Field label="العنوان" name="title_ar" maxLength={TITLE_MAX} value={titleAr} onChange={(event) => setTitleAr(event.target.value)} />
                <TextArea label="النص" rows={3} maxLength={BODY_MAX} value={bodyAr} onChange={(event) => setBodyAr(event.target.value)} />
              </div>
            ) : null}
          </Section>
        </div>
        <div className="flex flex-col gap-card-gap">
          <Card className="flex flex-col gap-3 p-section">
            <h2 className={cn(type.label, 'text-fg-tertiary')}>Preview</h2>
            <Preview title={title} body={body} />
            {arabic ? <Preview title={titleAr} body={bodyAr} rtl /> : null}
            {problem ? <ErrorNote>{problem}</ErrorNote> : null}
            {notice ? <p className={cn(type.callout, 'text-success')}>{notice}</p> : null}
            {role === 'admin' ? (
              <Button type="submit" disabled={busy || !ready}>
                Send to {audience?.reachable.toLocaleString('en-IN') ?? '…'}
              </Button>
            ) : (
              <p className={cn(type.caption, 'text-fg-tertiary')}>Only admins can send broadcasts.</p>
            )}
            {arabicIncomplete ? <p className={cn(type.caption, 'text-warning')}>Fill in both Arabic fields or untick the Arabic version.</p> : null}
          </Card>
        </div>
      </form>
      <h2 className={type.title}>sent</h2>
      {history.error ? (
        <ErrorNote>{history.error}</ErrorNote>
      ) : history.data === null ? (
        <Skeleton className="h-40" />
      ) : history.data.length === 0 ? (
        <Empty>No broadcasts yet.</Empty>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-start">
            <thead>
              <tr className={cn(type.labelSm, 'text-fg-tertiary')}>
                {['Message', 'Audience', 'Reached', 'Status', 'Sent'].map((heading) => (
                  <th key={heading} scope="col" className="px-4 py-3 text-start font-normal">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.data.map((item) => (
                <tr key={item.id} className="border-t border-line align-top">
                  <td className="px-4 py-3">
                    <span className="flex flex-col">
                      <span className={type.calloutStrong}>{item.title}</span>
                      <span className={cn(type.caption, 'text-fg-secondary')}>{item.body}</span>
                      <span className={cn(type.caption, 'text-fg-tertiary')}>
                        {describeSegment(item.segment)}
                        {item.title_ar ? ' · with Arabic' : ''} · by {item.created_by}
                      </span>
                    </span>
                  </td>
                  <td className={cn(type.callout, 'px-4 py-3 tabular-nums')}>{item.audience}</td>
                  <td className={cn(type.callout, 'px-4 py-3 tabular-nums')}>{item.reached}</td>
                  <td className="px-4 py-3">
                    <Pill tone={statusTone[item.status]}>{item.status}</Pill>
                    {item.error ? <span className={cn(type.caption, 'mt-1 block text-danger')}>{item.error}</span> : null}
                  </td>
                  <td className={cn(type.caption, 'px-4 py-3 text-fg-tertiary')}>{when(item.sent_at ?? item.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
