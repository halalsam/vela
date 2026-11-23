'use client';

import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { Container } from '@/components/ui';
import { cn } from '@/lib/type';

const labels = { en: 'Loading…', ar: 'جارٍ التحميل…' };

function Block({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-card bg-surface-1 motion-reduce:animate-none', className)} />;
}

function Status({ children, className }: { children: ReactNode; className?: string }) {
  const params = useParams<{ lang?: string }>();
  return (
    <div role="status" aria-busy className={className}>
      <span className="sr-only">{params?.lang === 'ar' ? labels.ar : labels.en}</span>
      {children}
    </div>
  );
}

export function PanelSkeleton({ className }: { className?: string }) {
  return (
    <Status className={cn('flex flex-col gap-4', className)}>
      <Block className="h-10 w-2/3 rounded-button" />
      <Block className="h-5 w-1/2 rounded-pill" />
      <Block className="h-48 w-full" />
    </Status>
  );
}

export function PageSkeleton() {
  return (
    <Container className="py-10 md:py-16">
      <Status className="flex flex-col gap-8">
        <Block className="h-14 w-3/4 max-w-xl rounded-button" />
        <Block className="h-5 w-1/2 max-w-md rounded-pill" />
        <div className="grid gap-card-gap sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <Block key={key} className="h-28" />
          ))}
        </div>
      </Status>
    </Container>
  );
}

export function DestinationSkeleton() {
  return (
    <Container className="pt-8 md:pt-14">
      <Status className="grid gap-12 md:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col gap-6">
          <Block className="h-5 w-24 rounded-pill" />
          <Block className="h-20 w-28" />
          <Block className="h-16 w-3/4 rounded-button" />
          <Block className="h-5 w-2/3 rounded-pill" />
          <div className="flex gap-2">
            {[0, 1, 2].map((key) => (
              <Block key={key} className="h-7 w-20 rounded-pill" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {[0, 1, 2, 3].map((key) => (
            <Block key={key} className="h-20" />
          ))}
          <Block className="h-button w-full rounded-button" />
        </div>
      </Status>
    </Container>
  );
}

export function CheckoutSkeleton() {
  return (
    <Container className="py-10 md:py-16">
      <Status className="flex flex-col gap-8">
        <Block className="h-14 w-56 rounded-button" />
        <div className="grid gap-8 md:grid-cols-[1fr_0.9fr]">
          <div className="flex flex-col gap-6">
            <Block className="h-24" />
            <Block className="h-20" />
            <Block className="h-20" />
          </div>
          <Block className="h-72" />
        </div>
      </Status>
    </Container>
  );
}

export function SuccessSkeleton() {
  return (
    <Container className="py-10 md:py-16">
      <Status className="grid gap-10 md:grid-cols-[auto_1fr]">
        <Block className="mx-auto h-64 w-64 md:mx-0" />
        <div className="flex flex-col gap-6">
          <Block className="h-14 w-3/4 rounded-button" />
          <Block className="h-5 w-1/2 rounded-pill" />
          <Block className="h-button w-48 rounded-button" />
          <Block className="h-32" />
        </div>
      </Status>
    </Container>
  );
}
