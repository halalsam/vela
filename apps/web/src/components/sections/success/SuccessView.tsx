'use client';

import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import { ButtonLink, Card, focusRing } from '@/components/ui';
import { format, type Dictionary } from '@/lib/i18n';
import { orderKey, parseOrder } from '@/lib/orders';
import { useStorageValue } from '@/lib/useStorage';
import { cn, type } from '@/lib/type';
import { CopyButton } from '../CopyButton';
import { MarkLockup } from '../Mark';

type Platform = 'iphone' | 'android';

export function SuccessView({ orderId, locale, labels }: { orderId: string; locale: string; labels: Dictionary['success'] }) {
  const raw = useStorageValue('session', orderKey(orderId));
  const entry = useMemo(() => (raw === undefined ? undefined : parseOrder(raw)), [raw]);
  const [svg, setSvg] = useState('');
  const [platform, setPlatform] = useState<Platform>('iphone');
  const lpa = entry?.esim.lpa_string;

  useEffect(() => {
    if (!lpa) return;
    void QRCode.toString(lpa, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0A0A0A', light: '#FFFFFF' } }).then(setSvg);
  }, [lpa]);

  if (entry === undefined) return <div className="h-96" aria-busy />;

  if (entry === null) {
    return (
      <div className="flex flex-col items-start gap-6 py-10">
        <h1 className={type.displayXl}>{labels.missingTitle}</h1>
        <p className={cn(type.body, 'text-fg-secondary')}>{labels.missingBody}</p>
        <div className="flex gap-3">
          <ButtonLink href={`/${locale}/account`}>{labels.toAccount}</ButtonLink>
          <ButtonLink href={`/${locale}`} variant="secondary">
            {labels.home}
          </ButtonLink>
        </div>
      </div>
    );
  }

  const [, smdp = '', code = ''] = entry.esim.lpa_string.split('$');
  const steps = platform === 'iphone' ? labels.iphoneSteps : labels.androidSteps;
  const installUrl = `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${encodeURIComponent(entry.esim.lpa_string)}`;

  return (
    <div className="grid gap-10 md:grid-cols-[0.9fr_1.1fr]">
      <div className="flex flex-col items-center gap-6 md:items-start">
        <MarkLockup showName={false} className="w-14 text-accent" />
        <div className="relative">
          <div aria-hidden className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(200,178,133,0.22),transparent_65%)] motion-safe:animate-fade" />
          <div
            role="img"
            aria-label={labels.qrLabel}
            className="relative h-64 w-64 rounded-card-lg bg-white p-5 motion-safe:animate-flip [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
        <p className={cn(type.caption, 'max-w-64 text-center text-fg-tertiary md:text-start')}>{labels.qrHint}</p>
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className={type.hero}>{labels.title}</h1>
          <p className={cn(type.callout, 'text-fg-secondary')}>{format(labels.body, { order: entry.order.order_id, plan: entry.title })}</p>
        </div>
        <div className="flex flex-col gap-2">
          <ButtonLink href={installUrl} className="self-start">
            {labels.installIphone}
          </ButtonLink>
          <p className={cn(type.caption, 'text-fg-tertiary')}>{labels.installHint}</p>
        </div>
        <Card className="divide-y divide-line">
          <h2 className={cn(type.label, 'px-section pb-2 pt-4 text-fg-tertiary')}>{labels.manual}</h2>
          {[
            { label: labels.smdp, value: smdp },
            { label: labels.code, value: code },
          ].map((row) => (
            <div key={row.label} className="flex items-center gap-4 px-section py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className={cn(type.caption, 'text-fg-tertiary')}>{row.label}</span>
                <span dir="ltr" className={cn(type.bodyStrong, 'truncate tracking-wide')}>
                  {row.value}
                </span>
              </div>
              <CopyButton value={row.value} label={row.label} copy={labels.copy} copied={labels.copied} />
            </div>
          ))}
        </Card>
        <section className="flex flex-col gap-4">
          <h2 className={type.displayMd}>{labels.stepsTitle}</h2>
          <div role="tablist" className="flex gap-2">
            {(['iphone', 'android'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={platform === key}
                onClick={() => setPlatform(key)}
                className={cn(
                  'h-9 rounded-pill border px-4',
                  type.callout,
                  platform === key ? 'border-fg bg-surface-3 text-fg' : 'border-line text-fg-secondary',
                  focusRing,
                )}
              >
                {labels[key]}
              </button>
            ))}
          </div>
          <ol role="tabpanel" className="flex flex-col gap-3">
            {steps.map((step, index) => (
              <li key={step} className="flex items-start gap-3">
                <span className={cn(type.calloutStrong, 'flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-surface-3')}>{index + 1}</span>
                <span className={cn(type.body, 'pt-0.5')}>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
