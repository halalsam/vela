import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, locales, type Locale } from '@/lib/i18n';

function preferredLocale(request: NextRequest): Locale {
  const header = request.headers.get('accept-language') ?? '';
  const wanted = header
    .split(',')
    .map((part) => part.split(';')[0]?.trim().slice(0, 2).toLowerCase())
    .find((code): code is Locale => (locales as readonly string[]).includes(code ?? ''));
  return wanted ?? defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some((locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`));
  if (hasLocale || pathname === '/admin' || pathname.startsWith('/admin/')) return;
  request.nextUrl.pathname = `/${preferredLocale(request)}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  matcher: ['/((?!_next|fonts|favicon|apple-touch-icon|icon-|maskable-|og\\.png|site\\.webmanifest|sitemap\\.xml|robots\\.txt).*)'],
};
