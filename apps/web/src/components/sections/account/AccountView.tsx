'use client';

import { PanelSkeleton } from '@/components/sections/Loading';
import type { Esim } from '@vela/api';
import { formatData, formatShortDate, isLowData, remainingFraction } from '@vela/utils';
import { useEffect, useState, type FormEvent } from 'react';
import { Flag } from '@/components/esim';
import { UsageRing } from '@/components/esim';
import { Button, ButtonLink, Card, Field, Pill } from '@/components/ui';
import { browserApi } from '@/lib/browserApi';
import { format, type Dictionary, type Locale } from '@/lib/i18n';
import { authClient } from '@/lib/authClient';
import { readAllOrders } from '@/lib/orders';
import { notifyStorage, useStorageValue } from '@/lib/useStorage';
import { cn, type } from '@/lib/type';
import { LiveSignIn } from './LiveSignIn';
import { TopUpPanel } from './TopUpPanel';

const SESSION_KEY = 'vela:session';

async function loadEsims(): Promise<Esim[]> {
  const esims = await browserApi.getEsims();
  const purchased = readAllOrders().map((entry) => entry.esim);
  return [...purchased, ...esims.filter((esim) => !purchased.some((item) => item.iccid === esim.iccid))];
}

type Names = Record<string, string>;
type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; esims: Esim[] };

export function AccountView(props: { locale: Locale; labels: Dictionary['account']; names: Names }) {
  return authClient ? <LiveAccount {...props} /> : <DemoAccount {...props} />;
}

function LiveAccount({ locale, labels, names }: { locale: Locale; labels: Dictionary['account']; names: Names }) {
  const client = authClient;
  const session = client?.useSession();
  if (!client || !session || session.isPending) return <PanelSkeleton className="max-w-xl" />;
  if (!session.data) return <LiveSignIn labels={labels} />;
  const user = session.data.user as { email: string; phoneNumber?: string | null };
  const identity = user.email.endsWith('@phone.vela.invalid') ? (user.phoneNumber ?? '') : user.email;
  return (
    <SignedInAccount
      locale={locale}
      labels={labels}
      names={names}
      identity={identity}
      live
      onSignOut={() => void client.signOut()}
    />
  );
}

function DemoAccount({ locale, labels, names }: { locale: Locale; labels: Dictionary['account']; names: Names }) {
  const email = useStorageValue('local', SESSION_KEY);
  const [draft, setDraft] = useState('');

  function signIn(event: FormEvent) {
    event.preventDefault();
    if (!draft.includes('@')) return;
    try {
      localStorage.setItem(SESSION_KEY, draft);
    } catch {
      return;
    }
    notifyStorage();
  }

  if (email === undefined) return <PanelSkeleton className="max-w-xl" />;

  if (!email) {
    return (
      <form onSubmit={signIn} className="flex max-w-md flex-col gap-6">
        <h1 className={type.hero}>{labels.signInTitle}</h1>
        <p className={cn(type.body, 'text-fg-secondary')}>{labels.signInBody}</p>
        <Field label={labels.email} name="email" type="email" autoComplete="email" value={draft} onChange={(event) => setDraft(event.target.value)} />
        <Button type="submit" disabled={!draft.includes('@')}>
          {labels.send}
        </Button>
      </form>
    );
  }

  return (
    <SignedInAccount
      locale={locale}
      labels={labels}
      names={names}
      identity={email}
      onSignOut={() => {
        try {
          localStorage.removeItem(SESSION_KEY);
        } catch {
          return;
        }
        notifyStorage();
      }}
    />
  );
}

type SignedInProps = {
  locale: Locale;
  labels: Dictionary['account'];
  names: Names;
  identity: string;
  live?: boolean;
  onSignOut: () => void;
};

function SignedInAccount({ locale, labels, names, identity, live = false, onSignOut }: SignedInProps) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadEsims().then(
      (esims) => !cancelled && setState({ status: 'ready', esims }),
      () => !cancelled && setState({ status: 'error' }),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className={type.hero}>{labels.title}</h1>
          <p className={cn(type.callout, 'text-fg-secondary')}>
            <span dir="ltr">{format(labels.signedInAs, { email: identity })}</span>
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          {labels.signOut}
        </Button>
      </div>
      <h2 className={cn(type.label, 'text-fg-tertiary')}>{labels.esims}</h2>
      {state.status === 'loading' ? (
        <ul className="grid gap-card-gap md:grid-cols-2" aria-label={labels.loading}>
          {[0, 1].map((key) => (
            <li key={key} className="h-36 animate-pulse rounded-card bg-surface-1 motion-reduce:animate-none" />
          ))}
        </ul>
      ) : state.status === 'error' ? (
        <Card className="flex flex-col items-start gap-4 p-section">
          <p role="alert" className={type.body}>
            {labels.error}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setState({ status: 'loading' });
              setAttempt((value) => value + 1);
            }}
          >
            {labels.retry}
          </Button>
        </Card>
      ) : state.esims.length === 0 ? (
        <Card className="flex flex-col items-start gap-4 p-8">
          <h3 className={type.displayMd}>{labels.emptyTitle}</h3>
          <p className={cn(type.callout, 'text-fg-secondary')}>{labels.emptyBody}</p>
          <ButtonLink href={`/${locale}#destinations`}>{labels.browse}</ButtonLink>
        </Card>
      ) : (
        <ul className="grid gap-card-gap md:grid-cols-2">
          {state.esims.map((esim) => (
            <EsimCard
              key={esim.iccid}
              esim={esim}
              locale={locale}
              labels={labels}
              names={names}
              live={live}
              onChanged={() => setAttempt((value) => value + 1)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

type EsimCardProps = { esim: Esim; locale: Locale; labels: Dictionary['account']; names: Names; live: boolean; onChanged: () => void };

function EsimCard({ esim, locale, labels, names, live, onChanged }: EsimCardProps) {
  const code = esim.country_codes[0] ?? '';
  const regionId = esim.plan_id.split('-')[0] ?? '';
  const name = (esim.country_codes.length > 1 ? names[regionId] : names[code]) ?? code;
  const ended = esim.status === 'expired' || esim.status === 'depleted';
  const low = esim.status === 'active' && isLowData(esim.data_used_mb, esim.data_total_mb);
  const status = ended
    ? { label: labels.expired, tone: 'danger' as const }
    : esim.status === 'not_started'
      ? { label: labels.notStarted, tone: 'neutral' as const }
      : low
        ? { label: labels.low, tone: 'warning' as const }
        : { label: labels.active, tone: 'success' as const };
  const left = formatData(Math.max(0, esim.data_total_mb - esim.data_used_mb));
  const total = formatData(esim.data_total_mb);
  return (
    <li>
      <Card className={cn('flex h-full flex-col gap-5 p-section motion-safe:animate-rise', ended && 'opacity-70')}>
        <div className="flex items-center gap-3">
          <Flag code={code} size="lg" />
          <div className="flex-1">
            <p className={type.title}>
              {name} · {total}
            </p>
            <p className={cn(type.caption, 'text-fg-tertiary')}>{esim.network}</p>
          </div>
          <Pill tone={status.tone}>{status.label}</Pill>
        </div>
        <div className="flex items-center gap-4">
          <UsageRing
            fraction={ended ? 0 : esim.status === 'not_started' ? 1 : remainingFraction(esim.data_used_mb, esim.data_total_mb)}
            tone={ended ? 'danger' : esim.status === 'not_started' ? 'muted' : low ? 'warning' : 'accent'}
            label={format(labels.left, { left, total })}
          />
          <div className="flex flex-col gap-1">
            <p className={type.bodyStrong}>{format(labels.left, { left, total })}</p>
            {esim.expires_at ? (
              <p className={cn(type.caption, 'text-fg-tertiary')}>{format(labels.validUntil, { date: formatShortDate(esim.expires_at, locale) })}</p>
            ) : null}
            {!ended && !live ? <p className={cn(type.caption, 'text-accent')}>{labels.topUpInApp}</p> : null}
          </div>
        </div>
        {live && esim.status !== 'expired' ? <TopUpPanel iccid={esim.iccid} labels={labels} onToppedUp={onChanged} /> : null}
      </Card>
    </li>
  );
}
