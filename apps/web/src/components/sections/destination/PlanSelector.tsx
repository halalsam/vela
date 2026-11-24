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
        <legend className={cn(type.label, 'mb-4 text-fg-tertiary')}>{labels.plans}</legend>
        {plans.map((plan) => {
          const checked = plan.id === selected;
          return (
            <label
              key={plan.id}
              className={cn(
                'flex cursor-pointer items-center gap-4 rounded-card border px-section py-4 transition duration-base ease-vela has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent',
                checked ? 'border-fg bg-surface-2 shadow-[0_0_32px_rgba(255,255,255,0.08)]' : 'border-line bg-surface-1 hover:border-line-strong',
                selected && !checked && 'opacity-60 hover:opacity-100',
                press,
              )}
            >
              <input type="radio" name="plan" value={plan.id} checked={checked} onChange={() => setSelected(plan.id)} className="sr-only" />
              <span className="flex flex-1 flex-col gap-1.5">
                <span className="flex items-baseline gap-2">
                  <span dir="ltr" className={type.dataMd}>
                    {plan.data}
                  </span>
                  <span className={cn(type.callout, 'text-fg-tertiary')}>{plan.days}</span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {plan.best ? (
                    <Pill tone="accent" caps>
                      {labels.bestValue}
                    </Pill>
                  ) : null}
                  {plan.is5g ? <Pill>{labels.fiveG}</Pill> : null}
                  {plan.hotspot ? <Pill>{labels.hotspot}</Pill> : null}
                </span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
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
            className={cn('inline-flex h-button items-center rounded-button bg-fg px-6 text-fg-inverse hover:bg-ivory', type.bodyStrong, focusRing, press)}
          >
            {labels.continue}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
