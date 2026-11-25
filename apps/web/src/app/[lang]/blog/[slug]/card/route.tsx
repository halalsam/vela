import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { formatDate, loadPost } from '@/lib/blog';
import { isLocale } from '@/lib/i18n';

// 1200×630 social card for a post with no cover or OG image of its own. English only: the image renderer
// can't shape Arabic, so Arabic posts fall back to /og.png (see socialImage in lib/blog).

export const revalidate = 3600;

const fonts = Promise.all(
  ['CabinetGrotesk-Bold.ttf', 'Satoshi-Medium.ttf'].map((file) => readFile(join(process.cwd(), 'public/fonts', file))),
);

export async function GET(_request: Request, { params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  if (!isLocale(lang) || lang !== 'en') return new Response('Not found', { status: 404 });
  const post = await loadPost(lang, slug);
  if (!post) return new Response('Not found', { status: 404 });
  const [display, body] = (await fonts) as [Buffer, Buffer];
  const title = post.title.length > 90 ? `${post.title.slice(0, 87)}…` : post.title;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'radial-gradient(circle at 85% 100%, rgba(200,178,133,0.28), rgba(10,10,10,0) 55%), #0a0a0a',
          color: '#f5f5f2',
          fontFamily: 'Satoshi',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 28, color: '#c8b285' }}>
          <span style={{ fontFamily: 'Cabinet', fontSize: 40, color: '#f5f5f2' }}>vela</span>
          <span style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.2)' }} />
          <span>{post.tags[0] ?? 'Travel guides'}</span>
        </div>
        <div style={{ display: 'flex', fontFamily: 'Cabinet', fontSize: title.length > 60 ? 64 : 76, lineHeight: 1.05, letterSpacing: '-0.02em', maxWidth: 1000 }}>
          {title}
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 26, color: 'rgba(245,245,242,0.6)' }}>
          <span>{formatDate(post.published_at, lang)}</span>
          <span>·</span>
          <span>{post.reading_minutes} min read</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Cabinet', data: display, weight: 700, style: 'normal' },
        { name: 'Satoshi', data: body, weight: 500, style: 'normal' },
      ],
    },
  );
}
