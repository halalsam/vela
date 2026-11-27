'use client';

import { PanelSkeleton } from '@/components/sections/Loading';
import type { Esim } from '@vela/api';
import { countdownParts, dataParts, formatData, formatShortDate, isEndingSoon, isLowData, remainingFraction } from '@vela/utils';
import { useEffect, useState, type FormEvent } from 'react';
import { TravelCard, type TravelKind } from '@/components/esim';
import { Button, ButtonLink, Card, Field } from '@/components/ui';
import { browserApi } from '@/lib/browserApi';
import { format, type Dictionary, type Locale } from '@/lib/i18n';
import { authClient } from '@/lib/authClient';
import { readAllOrders } from '@/lib/orders';
import { notifyStorage, useStorageValue } from '@/lib/useStorage';
import { cn, type } from '@/lib/type';
import { LiveSignIn } from './LiveSignIn';
import { SupportChat } from './SupportChat';
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
  return <SignedInAccount locale={locale} labels={labels} names={names} identity={identity} live onSignOut={() => void client.signOut()} />;
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
        <Field
          label={labels.email}
          name="email"
          type="email"
          autoComplete="email"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
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
          <ButtonLink href={`/${locale}/destinations`}>{labels.browse}</ButtonLink>
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
      <SupportChat locale={locale} labels={labels} esims={state.status === 'ready' ? state.esims : []} />
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
  const kind: TravelKind = ended ? 'ended' : esim.status === 'not_started' ? 'ready' : low ? 'low' : 'active';
  const status = { ended: labels.expired, ready: labels.ready, low: labels.low, active: labels.active }[kind];
  const remaining = Math.max(0, esim.data_total_mb - esim.data_used_mb);
  const amount = dataParts(kind === 'ready' ? esim.data_total_mb : remaining);
  const total = formatData(esim.data_total_mb);
  const parts = esim.expires_at ? countdownParts(esim.expires_at) : null;
  const countdown =
    parts && !parts.expired
      ? format(labels.countdown, { time: `${parts.days > 0 ? `${parts.days}${labels.dayUnit} ` : ''}${parts.hours}${labels.hourUnit}` })
      : null;
  return (
    <li className="motion-safe:animate-rise">
      <TravelCard
        className="h-full"
        code={esim.country_codes.length > 1 ? '' : code}
        name={name}
        subtitle={[total, esim.network].filter(Boolean).join(' · ')}
        kind={kind}
        status={status}
        amount={amount}
        amountLabel={format(kind === 'ready' ? labels.unitReady : labels.unitLeft, { unit: amount.unit })}
        totalLabel={kind === 'ready' ? labels.notStarted : format(labels.ofTotal, { total })}
        fraction={remainingFraction(esim.data_used_mb, esim.data_total_mb)}
        expires={esim.expires_at ? format(labels.expires, { date: formatShortDate(esim.expires_at, locale) }) : null}
        countdown={countdown}
        urgent={parts ? isEndingSoon(parts) : false}
        readyNote={labels.startsOnLanding}
      >
        {live && esim.status !== 'expired' ? (
          <TopUpPanel iccid={esim.iccid} labels={labels} onToppedUp={onChanged} />
        ) : !ended && !live ? (
          <p className={cn(type.caption, 'text-accent')}>{labels.topUpInApp}</p>
        ) : null}
      </TravelCard>
    </li>
  );
}
