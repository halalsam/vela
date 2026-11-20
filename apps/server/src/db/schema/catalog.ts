import { boolean, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { activationPolicy, currency, planType, regionType } from './enums';

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const region = pgTable('region', {
  id: text().primaryKey(),
  type: regionType().notNull(),
  nameEn: text().notNull(),
  nameAr: text().notNull(),
  ...timestamps,
});

export const country = pgTable('country', {
  code: text().primaryKey(),
  nameEn: text().notNull(),
  nameAr: text().notNull(),
  regionId: text().references(() => region.id),
  popular: boolean().notNull().default(false),
  ...timestamps,
});

export const plan = pgTable(
  'plan',
  {
    id: text().primaryKey(),
    providerPlanRef: text().notNull(),
    type: planType().notNull(),
    regionId: text().references(() => region.id),
    countryCodes: text().array().notNull(),
    dataMb: integer().notNull(),
    validityDays: integer().notNull(),
    is5g: boolean().notNull().default(false),
    hotspot: boolean().notNull().default(true),
    activation: activationPolicy().notNull().default('on_first_connection'),
    networks: text().array().notNull().default([]),
    costMinor: integer().notNull(),
    costCurrency: currency().notNull(),
    active: boolean().notNull().default(true),
    syncedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('plan_provider_ref_idx').on(table.providerPlanRef),
    index('plan_country_codes_idx').using('gin', table.countryCodes),
  ],
);

export const planPrice = pgTable(
  'plan_price',
  {
    planId: text()
      .notNull()
      .references(() => plan.id, { onDelete: 'cascade' }),
    currency: currency().notNull(),
    amountMinor: integer().notNull(),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.planId, table.currency] })],
);

export const topUpPack = pgTable('top_up_pack', {
  id: text().primaryKey(),
  providerPackRef: text().notNull().unique(),
  planId: text()
    .notNull()
    .references(() => plan.id, { onDelete: 'cascade' }),
  dataMb: integer().notNull(),
  extraDays: integer().notNull().default(0),
  costMinor: integer().notNull(),
  costCurrency: currency().notNull(),
  active: boolean().notNull().default(true),
  ...timestamps,
});

export const topUpPrice = pgTable(
  'top_up_price',
  {
    packId: text()
      .notNull()
      .references(() => topUpPack.id, { onDelete: 'cascade' }),
    currency: currency().notNull(),
    amountMinor: integer().notNull(),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.packId, table.currency] })],
);

export { timestamps };
