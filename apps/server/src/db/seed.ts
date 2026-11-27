import { blogPosts, countries, coupons, offers, regions } from '@vela/api/mocks';
import { sql } from 'drizzle-orm';
import type { Database } from './client';
import { blogPost, country, coupon, fxRate, offer, region, regionCountry } from './schema';
import { SAMPLE_RATES } from '../services/fx.service';

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
    // Placeholder blog posts so the site has a blog to show. They go in only while the table is empty (every
    // environment, production included), so deleting them in the admin after the first real post is enough.
    const [anyPost] = await tx.select({ id: blogPost.id }).from(blogPost).limit(1);
    if (!anyPost) {
      for (const item of blogPosts) {
        await tx
          .insert(blogPost)
          .values({
            locale: item.locale,
            slug: item.slug,
            title: item.title,
            excerpt: item.excerpt,
            body: item.body,
            coverImage: item.cover_image,
            coverAlt: item.cover_alt,
            authorName: item.author.name,
            authorRole: item.author.role,
            tags: item.tags,
            countryCodes: item.country_codes,
            status: 'published',
            publishedAt: new Date(item.published_at),
            alternateSlug: item.alternate_slug,
            metaTitle: item.seo.meta_title,
            metaDescription: item.seo.meta_description,
            keywords: item.seo.keywords,
            createdBy: 'seed',
          })
          .onConflictDoNothing();
      }
    }
    if (!options.sampleContent) return;
    for (const [currency, perUsd] of Object.entries(SAMPLE_RATES)) {
      await tx
        .insert(fxRate)
        .values({ currency: currency as keyof typeof SAMPLE_RATES, perUsd, source: 'sample', updatedAt: new Date(0) })
        .onConflictDoNothing();
    }
    for (const item of coupons) {
      const percent = item.discount_pct !== null;
      await tx
        .insert(coupon)
        .values({
          code: item.code,
          kind: percent ? 'percent' : 'amount',
          value: percent ? (item.discount_pct ?? 0) : Math.round((item.discount_amount ?? 0) * 100),
          currency: percent ? null : item.currency,
          perUserLimit: 1,
        })
        .onConflictDoNothing();
    }
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
