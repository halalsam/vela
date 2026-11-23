import { countries, offers, regions } from '@vela/api/mocks';
import { sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { country, offer, region, regionCountry } from '../../db/schema';

export async function seedReferenceData(db: Database, options: { sampleContent: boolean }) {
  await db.transaction(async (tx) => {
    for (const item of regions) {
      await tx
        .insert(region)
        .values({ id: item.id, type: item.id === 'global' ? 'global' : 'regional', nameEn: item.name.en, nameAr: item.name.ar })
        .onConflictDoUpdate({ target: region.id, set: { nameEn: sql`excluded.name_en`, nameAr: sql`excluded.name_ar` } });
    }
    for (const item of countries) {
      await tx
        .insert(country)
        .values({ code: item.code, nameEn: item.name.en, nameAr: item.name.ar, area: item.region, popular: item.popular })
        .onConflictDoUpdate({
          target: country.code,
          set: { nameEn: sql`excluded.name_en`, nameAr: sql`excluded.name_ar`, area: sql`excluded.area` },
        });
    }
    const known = new Set(countries.map((item) => item.code));
    for (const item of regions) {
      for (const code of item.country_codes.filter((value) => known.has(value))) {
        await tx.insert(regionCountry).values({ regionId: item.id, countryCode: code }).onConflictDoNothing();
      }
    }
    if (!options.sampleContent) return;
    for (const [index, item] of offers.entries()) {
      await tx
        .insert(offer)
        .values({
          id: item.id,
          titleEn: item.title.en,
          titleAr: item.title.ar,
          bodyEn: item.body.en,
          bodyAr: item.body.ar,
          tagEn: item.tag.en,
          tagAr: item.tag.ar,
          couponCode: item.code,
          discountPct: item.discount_pct,
          countryCodes: item.country_codes,
          endsAt: item.ends_at ? new Date(item.ends_at) : null,
          sortOrder: index,
        })
        .onConflictDoNothing();
    }
  });
}
