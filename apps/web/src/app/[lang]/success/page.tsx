import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SuccessView } from '@/components/sections/success/SuccessView';
import { Container } from '@/components/ui';
import { isLocale } from '@/lib/i18n';
import { getDictionary } from '../dictionaries';

export const metadata: Metadata = { robots: { index: false } };

export default async function SuccessPage({ params, searchParams }: PageProps<'/[lang]/success'>) {
  const { lang } = await params;
  const { order } = await searchParams;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return (
    <Container className="py-10 md:py-16">
      <SuccessView orderId={typeof order === 'string' ? order : ''} locale={lang} labels={dict.success} />
    </Container>
  );
}
