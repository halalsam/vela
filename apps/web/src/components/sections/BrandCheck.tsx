import { tagline } from '@vela/brand';
import { VelaLockup, VelaSymbol } from '@vela/brand/web';

export function BrandCheck() {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6 rounded-card-lg border border-line bg-surface-1 p-section shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="flex items-center justify-between">
        <VelaLockup size={32} className="text-fg" />
        <VelaSymbol size={24} className="text-accent" />
      </div>
      <p className="font-sans-semibold text-label uppercase text-fg-tertiary">Type check</p>
      <h1 className="font-display text-display-xl text-fg">{tagline}</h1>
      <p className="font-sans text-body text-fg-secondary">
        Travel eSIM data plans for India and the Gulf. The full site lands in Phase 7.
      </p>
      <p className="font-sans-light text-data-xl tabular-nums text-fg">3.80 GB</p>
      <p dir="rtl" lang="ar" className="font-arabic text-title text-fg">
        تصل وأنت متصل
      </p>
    </section>
  );
}
