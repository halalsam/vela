import Link from 'next/link';
import { Container } from '@/components/ui';
import { cn, type } from '@/lib/type';

export default function NotFound() {
  return (
    <Container className="flex flex-col items-start gap-4 py-24">
      <h1 className={type.hero}>lost at sea.</h1>
      <p className={cn(type.body, 'text-fg-secondary')}>This page doesn&apos;t exist. · هذه الصفحة غير موجودة.</p>
      <Link href="/" className={cn(type.bodyStrong, 'underline underline-offset-4')}>
        vela
      </Link>
    </Container>
  );
}
