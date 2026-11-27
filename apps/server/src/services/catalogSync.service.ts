import type { Database } from '../db/client';
import type { EsimProvider, ProviderPlan } from '../integrations/esims/provider';
import { countryInfo } from '../lib/geo';
import { regionNames } from '../lib/regionNames';
import type { Logger } from '../logger';
import * as catalog from '../models/catalog.model';
import { loadRates } from './fx.service';
import { planSlug, retailPrices, uniqueId } from './pricing.service';

export type SyncSummary = { created: number; updated: number; deactivated: number; total: number };

function packId(planId: string, pack: ProviderPlan['topUps'][number]): string {
  const size = pack.dataMb % 1024 === 0 ? `${pack.dataMb / 1024}gb` : `${pack.dataMb}mb`;
  return `${planId}-topup-${size}${pack.extraDays ? `-${pack.extraDays}d` : ''}`;
}

export function nominalGb(dataMb: number): number {
  const scale = dataMb % 1000 === 0 && dataMb % 1024 !== 0 ? 1000 : 1024;
  return Math.round((dataMb / scale) * 10) / 10;
}

export function findBackup(item: ProviderPlan, candidates: readonly ProviderPlan[]): ProviderPlan | null {
  const gb = nominalGb(item.dataMb);
  const matches = candidates.filter(
    (candidate) =>
      candidate.validityDays === item.validityDays &&
      nominalGb(candidate.dataMb) === gb &&
      item.countryCodes.every((code) => candidate.countryCodes.includes(code)),
  );
  return matches.sort((a, b) => a.countryCodes.length - b.countryCodes.length || a.cost.amountMinor - b.cost.amountMinor)[0] ?? null;
}

async function matchBackups(remote: readonly ProviderPlan[], backup: EsimProvider | null, logger: Logger): Promise<Map<string, string> | null> {
  const refs = new Map<string, string>();
  if (!backup) return refs;
  try {
    const candidates = await backup.listPlans();
    for (const item of remote) {
      const match = findBackup(item, candidates);
      if (match) refs.set(item.ref, match.ref);
    }
    logger.info({ backup: backup.name, matched: refs.size, of: remote.length }, 'backup plans matched');
  } catch (error) {
    logger.warn({ err: error, backup: backup.name }, 'backup catalogue unavailable; plans keep their previous backup');
    return null;
  }
  return refs;
}

export async function syncCatalog(
  db: Database,
  provider: EsimProvider,
  options: { marginPercent: number; logger: Logger; backup?: EsimProvider | null },
): Promise<SyncSummary> {
  const remote = await provider.listPlans();
  const backupRefs = await matchBackups(remote, options.backup ?? null, options.logger);
  const rates = await loadRates(db);
  const existing = await catalog.planRefs(db);
  const knownCountries = new Set(await catalog.countryCodes(db));
  const regions = new Set(await catalog.regionIds(db));
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
      await catalog.insertCountryIfNew(tx, { ...info, popular: false });
      knownCountries.add(code);
      addedCountries += 1;
    }

    for (const item of remote) {
      if (item.type === 'country' || !item.regionRef || regions.has(item.regionRef)) continue;
      const names = regionNames(item.regionName ?? item.regionRef);
      await catalog.insertRegionIfNew(
        tx,
        { id: item.regionRef, type: item.type === 'global' ? 'global' : 'regional', ...names },
        item.countryCodes.filter((value) => knownCountries.has(value)),
      );
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
        provider: provider.name,
        ...(backupRefs ? { backupProviderRef: backupRefs.get(item.ref) ?? null } : {}),
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
      await catalog.upsertPlan(tx, id, values);
      for (const price of retailPrices(item, options.marginPercent, rates)) {
        await catalog.upsertPlanPrice(tx, id, price.currency, price.amountMinor);
      }

      for (const pack of item.topUps) {
        const storedId = await catalog.upsertTopUpPack(
          tx,
          { id: packId(id, pack), planId: id, providerPackRef: pack.ref },
          {
            dataMb: pack.dataMb,
            extraDays: pack.extraDays,
            costMinor: pack.cost.amountMinor,
            costCurrency: pack.cost.currency,
            active: true,
          },
        );
        if (!storedId) continue;
        seenPacks.push(storedId);
        for (const price of retailPrices(pack, options.marginPercent, rates)) {
          await catalog.upsertTopUpPrice(tx, storedId, price.currency, price.amountMinor);
        }
      }
    }

    await catalog.deactivateTopUpsExcept(tx, seenPacks);
    deactivated = await catalog.deactivatePlansExcept(
      tx,
      remote.map((item) => item.ref),
    );
  });

  const total = await catalog.countActivePlans(db);
  const summary = { created, updated, deactivated, total };
  options.logger.info({ provider: provider.name, addedCountries, currencies: [...rates.keys()], ...summary }, 'catalog synced');
  return summary;
}
