import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { timestamps } from './catalog';
import { currency, devicePlatform, userRole } from './enums';

export const profile = pgTable(
  'profile',
  {
    userId: text()
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text(),
    email: text(),
    phone: text(),
    language: text().notNull().default('en'),
    currency: currency().notNull().default('INR'),
    role: userRole().notNull().default('customer'),
    referralCode: text().notNull(),
    referredBy: text(),
    deletedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex('profile_referral_code_idx').on(table.referralCode)],
);

export const device = pgTable(
  'device',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    platform: devicePlatform().notNull(),
    pushToken: text().notNull(),
    locale: text().notNull().default('en'),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [uniqueIndex('device_push_token_idx').on(table.pushToken), index('device_user_idx').on(table.userId)],
);
