'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Pill, focusRing, press } from '@/components/ui';
import type { PlanView } from '@/lib/destinations';
import { format } from '@/lib/i18n';
import { useLocalPlans, type PlanSource } from '@/lib/localPrices';
import { cn, type } from '@/lib/type';

type Labels = {
  plans: string;
  bestValue: string;
  fiveG: string;
  hotspot: string;
  continue: string;
};

type Props = { plans: PlanView[]; labels: Labels; checkoutBase: string; source: PlanSource; perGbTemplate: string };

export function PlanSelector({ plans: serverPlans, labels, checkoutBase, source, perGbTemplate }: Props) {
  const local = useLocalPlans(source);
  const plans = local
    ? serverPlans.map((plan) => {
        const swap = local.get(plan.id);
        return swap ? { ...plan, price: swap.price, perGb: format(perGbTemplate, { price: swap.perGbAmount }) } : plan;
      })
    : serverPlans;
  const [selected, setSelected] = useState(plans[1]?.id ?? plans[0]?.id);
  const current = plans.find((plan) => plan.id === selected);
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-card-gap">
        <legend className={cn(type.title, 'mb-3 text-fg')}>{labels.plans}</legend>
        {plans.map((plan) => {
          const checked = plan.id === selected;
          const features = [plan.is5g ? labels.fiveG : null, plan.hotspot ? labels.hotspot : null].filter(Boolean).join(' · ');
          // Same card as the app: radio, size and validity, price. Other plans are not dimmed.
          return (
            <label
              key={plan.id}
              className={cn(
                'flex cursor-pointer items-center gap-4 rounded-card p-4 transition-colors duration-base ease-vela has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
                checked
                  ? 'border-2 border-fg bg-surface-2 p-[15px]'
                  : 'border border-line border-t-line-highlight bg-surface-1 hover:border-line-strong',
                press,
              )}
            >
              <input type="radio" name="plan" value={plan.id} checked={checked} onChange={() => setSelected(plan.id)} className="sr-only" />
              <span
                aria-hidden
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-pill',
                  checked ? 'bg-fg text-fg-inverse' : 'border-2 border-line-strong',
                )}
              >
                {checked ? (
                  <svg
                    viewBox="0 0 12 12"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2.5 6.5 5 9l4.5-6" />
                  </svg>
                ) : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span dir="ltr" className={type.dataSm}>
                    {plan.data}
                  </span>
                  {plan.best ? <Pill tone="accent">{labels.bestValue}</Pill> : null}
                </span>
                <span className={cn(type.caption, 'truncate text-fg-tertiary')}>{features ? `${plan.days} · ${features}` : plan.days}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span dir="ltr" className={type.dataSm}>
                  {plan.price}
                </span>
                <span className={cn(type.caption, 'text-fg-tertiary')}>{plan.perGb}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {current ? (
        <div className="sticky bottom-4 z-20 flex items-center gap-4 rounded-sheet border border-line border-t-line-highlight bg-surface-1/80 py-2.5 pe-2.5 ps-5 backdrop-blur-xl">
          <span className="flex flex-1 flex-col">
            <span className={cn(type.caption, 'text-fg-tertiary')}>
              {current.data} · {current.days}
            </span>
            <span dir="ltr" className={cn(type.dataSm, 'self-start rtl:self-end')}>
              {current.price}
            </span>
          </span>
          <Link
            href={`${checkoutBase}?plan=${current.id}`}
            className={cn(
              'inline-flex h-button items-center rounded-button bg-fg px-6 text-fg-inverse hover:bg-ivory',
              type.bodyStrong,
              focusRing,
              press,
            )}
          >
            {labels.continue}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
