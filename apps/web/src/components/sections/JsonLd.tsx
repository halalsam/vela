import { ldJson, type JsonLd as Data } from '@/lib/seo';

/** One <script type="application/ld+json"> with every block for the page. */
export function JsonLd({ data }: { data: Data[] }) {
  if (data.length === 0) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(data.length === 1 ? data[0]! : data) }} />;
}
