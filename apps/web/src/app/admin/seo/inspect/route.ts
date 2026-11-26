import { siteUrl } from '@/lib/site';

// Fetches one of this site's own pages and reports what search engines will read from it. The host is always
// siteUrl, so only our own public pages can be inspected.

export const dynamic = 'force-dynamic';

// Next streams metadata into the body for browsers and puts it in <head> only for crawlers, so ask as Googlebot to
// read exactly what Google reads.
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) vela-seo-inspector';

type Check = { id: string; label: string; hint: string; state: 'good' | 'warn' | 'bad' };

const decode = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .trim();

const attr = (tag: string, name: string) => {
  const match = tag.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? decode(match[1] ?? match[2] ?? '') : null;
};

const stripTags = (html: string) => decode(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get('path') ?? '/en';
  if (!/^\/[A-Za-z0-9\-/._~%]*$/.test(path) || path.includes('..') || path.startsWith('//')) {
    return Response.json({ error: 'Use a path on this site, starting with /' }, { status: 400 });
  }
  const started = Date.now();
  let response: Response;
  try {
    response = await fetch(`${siteUrl}${path}`, { cache: 'no-store', redirect: 'follow', headers: { 'user-agent': GOOGLEBOT } });
  } catch {
    return Response.json({ error: `Couldn’t reach ${siteUrl}${path}` }, { status: 502 });
  }
  // Inline SVG <title>s are icon labels, not the page title.
  const html = (await response.text()).replace(/<svg\b[\s\S]*?<\/svg>/gi, '');
  const ms = Date.now() - started;
  // Pages with a loading state stream their content and tags after the first shell, so read the whole document.
  const head = html;
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const meta = (key: string) => {
    const tag = metas.find((item) => attr(item, 'name') === key || attr(item, 'property') === key);
    return tag ? attr(tag, 'content') : null;
  };
  const title = decode(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const canonical = links.map((tag) => (attr(tag, 'rel') === 'canonical' ? attr(tag, 'href') : null)).find(Boolean) ?? null;
  const hreflang = links
    .filter((tag) => attr(tag, 'rel') === 'alternate' && attr(tag, 'hreflang'))
    .map((tag) => ({ lang: attr(tag, 'hreflang') ?? '', href: attr(tag, 'href') ?? '' }));
  const bodyHtml = html.slice(html.search(/<body/i));
  // Content only: drop the site header (the header before <main>), the site footer (the last one), scripts and
  // streaming templates. Headers inside the page, which often hold the H1, stay.
  let content = bodyHtml;
  const siteHeader = content.match(/<header\b[\s\S]*?<\/header>/i);
  if (siteHeader && siteHeader.index !== undefined && siteHeader.index < content.search(/<main\b/i)) content = content.replace(siteHeader[0], ' ');
  const footerStart = content.toLowerCase().lastIndexOf('<footer');
  if (footerStart >= 0) content = content.slice(0, footerStart) + content.slice(content.indexOf('</footer>', footerStart) + 9);
  const cleanMain = content
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<template[\s\S]*?<\/template>/gi, ' ')
    .replace(/<(title|meta|link)\b[^>]*>(?:[^<]*<\/title>)?/gi, ' ');
  const h1 = [...cleanMain.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => stripTags(match[1] ?? ''));
  const h2 = [...cleanMain.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((match) => stripTags(match[1] ?? ''));
  const images = [...cleanMain.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  const imagesWithoutAlt = images.filter((tag) => attr(tag, 'alt') === null).length;
  const words = stripTags(cleanMain).split(/\s+/).filter(Boolean).length;
  const anchors = [...cleanMain.matchAll(/<a\b[^>]*>/gi)].map((match) => attr(match[0], 'href') ?? '');
  const internalLinks = anchors.filter((href) => href.startsWith('/') || href.startsWith(siteUrl)).length;
  const jsonLd = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => {
    try {
      const parsed: unknown = JSON.parse(match[1] ?? '');
      const list = (Array.isArray(parsed) ? parsed : [parsed]) as { '@type'?: string | string[] }[];
      return { valid: true, types: list.flatMap((item) => item['@type'] ?? []).map(String) };
    } catch {
      return { valid: false, types: [] as string[] };
    }
  });
  const robots = meta('robots');
  const description = meta('description');
  const ogImage = meta('og:image');
  const lang = html.match(/<html[^>]*\slang="([^"]+)"/i)?.[1] ?? null;

  const checks: Check[] = [
    { id: 'status', label: `HTTP ${response.status}`, hint: 'The page must answer 200 to rank.', state: response.ok ? 'good' : 'bad' },
    { id: 'title', label: title ? `Title: ${title.length} characters` : 'No <title>', hint: 'Aim for 30 to 60 characters.', state: !title ? 'bad' : title.length >= 30 && title.length <= 60 ? 'good' : 'warn' },
    {
      id: 'description',
      label: description ? `Meta description: ${description.length} characters` : 'No meta description',
      hint: 'Aim for 70 to 160 characters.',
      state: !description ? 'bad' : description.length >= 70 && description.length <= 160 ? 'good' : 'warn',
    },
    { id: 'h1', label: h1.length === 1 ? 'One H1 heading' : `${h1.length} H1 headings`, hint: 'Each page should have exactly one H1 saying what it is about.', state: h1.length === 1 ? 'good' : 'bad' },
    { id: 'h2', label: `${h2.length} H2 subheadings`, hint: 'Subheadings help readers and search engines scan the page.', state: h2.length > 0 ? 'good' : 'warn' },
    { id: 'canonical', label: canonical ? 'Has a canonical URL' : 'No canonical URL', hint: 'A canonical stops duplicate URLs competing.', state: canonical ? 'good' : 'warn' },
    { id: 'hreflang', label: `${hreflang.length} language alternates`, hint: 'English and Arabic versions should link to each other, plus x-default.', state: hreflang.length >= 2 ? 'good' : 'warn' },
    { id: 'robots', label: robots ? `Robots: ${robots}` : 'Robots: index, follow (default)', hint: 'noindex keeps the page out of search results.', state: robots?.includes('noindex') ? 'bad' : 'good' },
    { id: 'og', label: ogImage ? 'Has a social image' : 'No og:image', hint: 'Links shared without an image get far fewer clicks.', state: ogImage ? 'good' : 'warn' },
    {
      id: 'jsonld',
      label: jsonLd.length === 0 ? 'No structured data' : `Structured data: ${[...new Set(jsonLd.flatMap((item) => item.types))].join(', ') || 'untyped'}`,
      hint: 'JSON-LD helps search engines show rich results.',
      state: jsonLd.some((item) => !item.valid) ? 'bad' : jsonLd.length > 0 ? 'good' : 'warn',
    },
    {
      id: 'alt',
      label: imagesWithoutAlt === 0 ? `${images.length} images, all with alt text` : `${imagesWithoutAlt} of ${images.length} images without alt`,
      hint: 'Add alt text (or alt="" for decoration).',
      state: imagesWithoutAlt === 0 ? 'good' : 'warn',
    },
    { id: 'words', label: `About ${words} words of content`, hint: 'Pages under 250 words can look thin to search engines.', state: words >= 250 ? 'good' : words >= 100 ? 'warn' : 'bad' },
    { id: 'links', label: `${internalLinks} internal links`, hint: 'Linking to related pages spreads ranking across the site.', state: internalLinks >= 3 ? 'good' : 'warn' },
    { id: 'lang', label: lang ? `Language: ${lang}` : 'No lang attribute', hint: 'The html tag should say the page language.', state: lang ? 'good' : 'warn' },
    { id: 'speed', label: `Server answered in ${ms} ms`, hint: 'Slow pages rank lower. Under 800 ms is good.', state: ms < 800 ? 'good' : ms < 2000 ? 'warn' : 'bad' },
  ];

  return Response.json({
    url: `${siteUrl}${path}`,
    status: response.status,
    ms,
    title,
    description,
    canonical,
    robots,
    hreflang,
    og: { title: meta('og:title'), description: meta('og:description'), image: ogImage, type: meta('og:type') },
    twitter: { card: meta('twitter:card'), site: meta('twitter:site') },
    h1,
    h2: h2.slice(0, 20),
    jsonLd,
    checks,
  });
}
