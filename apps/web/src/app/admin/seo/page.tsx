import { SeoView, type SeoAdminDefaults } from '@/components/admin/SeoView';
import { loadCatalog } from '@/lib/destinations';
import { locales } from '@/lib/i18n';
import { pageDefaults } from '@/lib/seo';
import { seoPageDefs } from '@/lib/seoCore';
import { formatPrice } from '@vela/utils';

// Built-in defaults are worked out here, on the server, so the editor can show what each empty field falls back to.
export default async function AdminSeoPage() {
  const [{ countries, regions }, entries] = await Promise.all([
    loadCatalog(),
    Promise.all(seoPageDefs.flatMap((def) => locales.map(async (locale) => [`${def.key}:${locale}`, await pageDefaults(def.key, locale)] as const))),
  ]);
  const defaults: SeoAdminDefaults = {
    pages: Object.fromEntries(entries),
    destinations: [
      ...countries.map((country) => ({
        slug: country.code.toLowerCase(),
        name: country.name,
        price: formatPrice(country.from_price, country.currency),
        countries: 1,
        region: false,
      })),
      ...regions.map((region) => ({
        slug: region.id,
        name: region.name,
        price: formatPrice(region.from_price, region.currency),
        countries: region.country_codes.length,
        region: true,
      })),
    ],
  };
  return <SeoView defaults={defaults} />;
}
