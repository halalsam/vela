import { and, eq, notInArray, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { country, plan, planPrice, region, regionCountry, topUpPack, topUpPrice } from '../../db/schema';
import type { Logger } from '../../logger';
import type { EsimProvider, ProviderPlan } from '../esims/provider';
import { loadRates } from './fx';
import { countryInfo } from './geo';
import { planSlug, retailPrices, uniqueId } from './pricing';

export type SyncSummary = { created: number; updated: number; deactivated: number; total: number };

function packId(planId: string, pack: ProviderPlan['topUps'][number]): string {
  const size = pack.dataMb % 1024 === 0 ? `${pack.dataMb / 1024}gb` : `${pack.dataMb}mb`;
  return `${planId}-topup-${size}${pack.extraDays ? `-${pack.extraDays}d` : ''}`;
}

export async function syncCatalog(
  db: Database,
  provider: EsimProvider,
  options: { marginPercent: number; logger: Logger },
): Promise<SyncSummary> {
  const remote = await provider.listPlans();
  const rates = await loadRates(db);
  const existing = await db.select({ id: plan.id, ref: plan.providerPlanRef }).from(plan);
  const knownCountries = new Set((await db.select({ code: country.code }).from(country)).map((row) => row.code));
  const regions = new Set((await db.select({ id: region.id }).from(region)).map((row) => row.id));
  const idByRef = new Map(existing.map((row) => [row.ref, row.id]));
  const taken = new Set(existing.map((row) => row.id));
  const now = new Date();
  let created = 0;
  let updated = 0;
  let deactivated = 0;
  let addedCountries = 0;

  await db.transaction(async (tx) => {
    for (const code of new Set(remote.flatMap((item) => item.countryCodes))) {
      if (knownCountries.has(code)) continue;
      const info = countryInfo(code);
      if (!info) continue;
      await tx.insert(country).values({ ...info, popular: false }).onConflictDoNothing();
      knownCountries.add(code);
      addedCountries += 1;
    }

    for (const item of remote) {
      if (item.type === 'country' || !item.regionRef || regions.has(item.regionRef)) continue;
      const name = item.regionName ?? item.regionRef;
      await tx
        .insert(region)
        .values({ id: item.regionRef, type: item.type === 'global' ? 'global' : 'regional', nameEn: name, nameAr: name })
        .onConflictDoNothing();
      for (const code of item.countryCodes.filter((value) => knownCountries.has(value))) {
        await tx.insert(regionCountry).values({ regionId: item.regionRef, countryCode: code }).onConflictDoNothing();
      }
      regions.add(item.regionRef);
    }

    const seenPacks: string[] = [];
    for (const item of remote) {
      let id = idByRef.get(item.ref);
      if (id) {
        updated += 1;
      } else {
        id = uniqueId(planSlug(item), taken);
        taken.add(id);
        idByRef.set(item.ref, id);
        created += 1;
      }
      const values = {
        providerPlanRef: item.ref,
        type: item.type,
        regionId: item.regionRef && regions.has(item.regionRef) ? item.regionRef : null,
        countryCodes: item.countryCodes,
        dataMb: item.dataMb,
        validityDays: item.validityDays,
        is5g: item.is5g,
        hotspot: item.hotspot,
        activation: item.activation,
        networks: item.networks,
        costMinor: item.cost.amountMinor,
        costCurrency: item.cost.currency,
        active: true,
        syncedAt: now,
      };
      await tx.insert(plan).values({ id, ...values }).onConflictDoUpdate({ target: plan.id, set: values });
      for (const price of retailPrices(item, options.marginPercent, rates)) {
        await tx
          .insert(planPrice)
          .values({ planId: id, currency: price.currency, amountMinor: price.amountMinor })
          .onConflictDoUpdate({
            target: [planPrice.planId, planPrice.currency],
            set: { amountMinor: price.amountMinor },
            setWhere: eq(planPrice.manual, false),
          });
      }

      for (const pack of item.topUps) {
        const packValues = {
          dataMb: pack.dataMb,
          extraDays: pack.extraDays,
          costMinor: pack.cost.amountMinor,
          costCurrency: pack.cost.currency,
          active: true,
        };
        const [stored] = await tx
          .insert(topUpPack)
          .values({ id: packId(id, pack), planId: id, providerPackRef: pack.ref, ...packValues })
          .onConflictDoUpdate({ target: [topUpPack.planId, topUpPack.providerPackRef], set: packValues })
          .returning({ id: topUpPack.id });
        if (!stored) continue;
        seenPacks.push(stored.id);
        for (const price of retailPrices(pack, options.marginPercent, rates)) {
          await tx
            .insert(topUpPrice)
            .values({ packId: stored.id, currency: price.currency, amountMinor: price.amountMinor })
            .onConflictDoUpdate({ target: [topUpPrice.packId, topUpPrice.currency], set: { amountMinor: price.amountMinor } });
        }
      }
    }

    await tx
      .update(topUpPack)
      .set({ active: false })
      .where(seenPacks.length > 0 ? and(eq(topUpPack.active, true), notInArray(topUpPack.id, seenPacks)) : eq(topUpPack.active, true));

    const refs = remote.map((item) => item.ref);
    const stale = await tx
      .update(plan)
      .set({ active: false })
      .where(refs.length > 0 ? and(eq(plan.active, true), notInArray(plan.providerPlanRef, refs)) : eq(plan.active, true))
      .returning({ id: plan.id });
    deactivated = stale.length;
  });

  const [{ total } = { total: 0 }] = await db.select({ total: sql<number>`count(*)::int` }).from(plan).where(eq(plan.active, true));
  const summary = { created, updated, deactivated, total };
  options.logger.info({ provider: provider.name, addedCountries, currencies: [...rates.keys()], ...summary }, 'catalog synced');
  return summary;
}
