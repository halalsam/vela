export const type = {
  hero: 'font-display text-display-xl lowercase md:text-[72px] md:leading-[76px] rtl:font-arabic-light rtl:normal-case rtl:text-display-xl-ar md:rtl:text-[60px] md:rtl:leading-[80px]',
  displayXl: 'font-display text-display-xl lowercase rtl:font-arabic-light rtl:normal-case rtl:text-display-xl-ar',
  displayLg: 'font-display text-display-lg lowercase rtl:font-arabic-light rtl:normal-case rtl:text-display-lg-ar',
  displayMd: 'font-display text-display-md lowercase rtl:font-arabic-light rtl:normal-case rtl:text-display-md-ar',
  title: 'font-sans-semibold text-title rtl:font-arabic-semibold rtl:text-title-ar',
  body: 'font-sans text-body rtl:font-arabic rtl:text-body-ar',
  bodyStrong: 'font-sans-semibold text-body rtl:font-arabic-semibold rtl:text-body-ar',
  callout: 'font-sans text-callout rtl:font-arabic rtl:text-callout-ar',
  calloutStrong: 'font-sans-semibold text-callout rtl:font-arabic-semibold rtl:text-callout-ar',
  caption: 'font-sans text-caption rtl:font-arabic rtl:text-caption-ar',
  label: 'font-sans-semibold text-label uppercase rtl:font-arabic-semibold rtl:normal-case rtl:text-label-ar',
  labelSm: 'font-sans-semibold text-label-sm uppercase rtl:font-arabic-semibold rtl:normal-case rtl:text-label-sm-ar',
  dataXl: 'font-sans-light text-data-xl tabular-nums',
  dataLg: 'font-sans-light text-data-lg tabular-nums',
  dataMd: 'font-sans-medium text-data-md tabular-nums',
  dataSm: 'font-sans-medium text-data-sm tabular-nums',
} as const;

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
