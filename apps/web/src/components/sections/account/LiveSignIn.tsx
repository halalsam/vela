'use client';

import { useState, type FormEvent } from 'react';
import { Button, Field } from '@/components/ui';
import { authClient } from '@/lib/authClient';
import { format, type Dictionary } from '@/lib/i18n';
import { cn, type } from '@/lib/type';

const E164 = /^\+[1-9]\d{7,14}$/;

export function LiveSignIn({ labels }: { labels: Dictionary['account'] }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalised = `+${phone.replace(/\D/g, '')}`;

  if (!authClient) return null;
  const client = authClient;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    if (step === 'phone') {
      const result = await client.phoneNumber.sendOtp({ phoneNumber: normalised });
      if (result.error) setError(labels.failed);
      else setStep('code');
    } else {
      const result = await client.phoneNumber.verify({ phoneNumber: normalised, code });
      if (result.error) setError(result.error.status === 400 || result.error.status === 403 ? labels.wrongCode : labels.failed);
    }
    setBusy(false);
  }

  return (
    <div className="flex max-w-md flex-col gap-6">
      <h1 className={type.hero}>{labels.signInTitle}</h1>
      <p className={cn(type.body, 'text-fg-secondary')}>{labels.liveSignInBody}</p>
      <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
        {step === 'phone' ? (
          <Field
            label={labels.phone}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder={labels.phonePlaceholder}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            error={error}
          />
        ) : (
          <>
            <p className={cn(type.callout, 'text-fg-secondary')}>{format(labels.sent, { phone: normalised })}</p>
            <Field
              label={labels.code}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              error={error}
            />
          </>
        )}
        <Button type="submit" disabled={busy || (step === 'phone' ? !E164.test(normalised) : code.length !== 6)} aria-busy={busy}>
          {step === 'phone' ? labels.sendCode : labels.verify}
        </Button>
        {step === 'code' ? (
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setStep('phone')}>
            {labels.changeNumber}
          </Button>
        ) : null}
      </form>
      <div className="flex items-center gap-3 text-fg-tertiary">
        <span className="h-px flex-1 bg-line" />
        <span className={type.caption}>{labels.or}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
      <Button variant="secondary" onClick={() => void client.signIn.social({ provider: 'google', callbackURL: window.location.href })}>
        {labels.google}
      </Button>
    </div>
  );
}
