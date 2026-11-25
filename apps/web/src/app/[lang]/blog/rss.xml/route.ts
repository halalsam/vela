import { brandName } from '@vela/brand';
import { absolute, blogPath, loadPosts } from '@/lib/blog';
import { isLocale } from '@/lib/i18n';
import { siteUrl } from '@/lib/site';
import { getDictionary } from '../../dictionaries';

export const revalidate = 600;

const escape = (value: string) =>
  value.replace(/[<>&'"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char] ?? char);

export async function GET(_request: Request, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) return new Response('Not found', { status: 404 });
  const [dict, posts] = await Promise.all([getDictionary(lang), loadPosts(lang)]);
  const feedUrl = absolute(`${blogPath(lang)}/rss.xml`);
  const items = posts
    .map((post) => {
      const url = absolute(blogPath(lang, post.slug));
      return `    <item>
      <title>${escape(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escape(post.excerpt)}</description>
      <pubDate>${new Date(post.published_at).toUTCString()}</pubDate>
${post.tags.map((tag) => `      <category>${escape(tag)}</category>`).join('\n')}
    </item>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(`${brandName} · ${dict.blog.title}`)}</title>
    <link>${absolute(blogPath(lang))}</link>
    <description>${escape(dict.meta.blogDescription)}</description>
    <language>${lang}</language>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
    <image><url>${siteUrl}/icon-192.png</url><title>${escape(brandName)}</title><link>${absolute(blogPath(lang))}</link></image>
${posts[0] ? `    <lastBuildDate>${new Date(posts[0].updated_at).toUTCString()}</lastBuildDate>\n` : ''}${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=600' } });
}
