import { date, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { device } from './accounts';
import { plan, timestamps } from './catalog';
import { esimStatus } from './enums';

export const esim = pgTable(
  'esim',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text().notNull(),
    iccid: text().notNull(),
    planId: text()
      .notNull()
      .references(() => plan.id),
    providerRef: text().notNull(),
    provider: text().notNull().default(''),
    status: esimStatus().notNull().default('not_started'),
    label: text().notNull(),
    dataUsedMb: integer().notNull().default(0),
    dataTotalMb: integer().notNull(),
    activatedAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }),
    smdp: text().notNull(),
    lpaEnc: text().notNull(),
    activationCodeEnc: text().notNull(),
    usageSyncedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('esim_iccid_idx').on(table.iccid),
    index('esim_user_idx').on(table.userId),
    index('esim_status_idx').on(table.status),
  ],
);

export const usageSnapshot = pgTable(
  'usage_snapshot',
  {
    esimId: uuid()
      .notNull()
      .references(() => esim.id, { onDelete: 'cascade' }),
    day: date({ mode: 'string' }).notNull(),
    usedMb: integer().notNull(),
  },
  (table) => [primaryKey({ columns: [table.esimId, table.day] })],
);

export const liveActivity = pgTable(
  'live_activity',
  {
    id: uuid().primaryKey().defaultRandom(),
    esimId: uuid()
      .notNull()
      .references(() => esim.id, { onDelete: 'cascade' }),
    deviceId: uuid().references(() => device.id, { onDelete: 'set null' }),
    userId: text().notNull(),
    locale: text().notNull().default('en'),
    pushToken: text().notNull(),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex('live_activity_token_idx').on(table.pushToken), index('live_activity_esim_idx').on(table.esimId)],
);

export const esimNotice = pgTable(
  'esim_notice',
  {
    esimId: uuid()
      .notNull()
      .references(() => esim.id, { onDelete: 'cascade' }),
    kind: text().notNull(),
    sentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.esimId, table.kind] })],
);
