import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { plan, timestamps } from './catalog';
import { couponKind, currency, orderKind, orderStatus, paymentProvider, paymentStatus } from './enums';

export const coupon = pgTable(
  'coupon',
  {
    code: text().primaryKey(),
    kind: couponKind().notNull(),
    value: integer().notNull(),
    currency: currency(),
    maxRedemptions: integer(),
    perUserLimit: integer().notNull().default(1),
    countryCodes: text().array().notNull().default([]),
    startsAt: timestamp({ withTimezone: true }),
    endsAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [check('coupon_value_positive', sql`${table.value} > 0`)],
);

export const order = pgTable(
  'order',
  {
    id: uuid().primaryKey().defaultRandom(),
    number: text().notNull(),
    userId: text().notNull(),
    kind: orderKind().notNull(),
    status: orderStatus().notNull().default('draft'),
    planId: text().references(() => plan.id),
    topUpPackId: text(),
    esimId: uuid(),
    currency: currency().notNull(),
    subtotalMinor: integer().notNull(),
    discountMinor: integer().notNull().default(0),
    creditMinor: integer().notNull().default(0),
    taxMinor: integer().notNull().default(0),
    totalMinor: integer().notNull(),
    couponCode: text().references(() => coupon.code),
    referralCode: text(),
    idempotencyKey: text().notNull(),
    paidAt: timestamp({ withTimezone: true }),
    fulfilledAt: timestamp({ withTimezone: true }),
    failureReason: text(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('order_number_idx').on(table.number),
    uniqueIndex('order_user_idempotency_idx').on(table.userId, table.idempotencyKey),
    index('order_user_idx').on(table.userId),
    index('order_status_idx').on(table.status),
    check('order_total_non_negative', sql`${table.totalMinor} >= 0`),
  ],
);

export const couponRedemption = pgTable(
  'coupon_redemption',
  {
    id: uuid().primaryKey().defaultRandom(),
    couponCode: text()
      .notNull()
      .references(() => coupon.code),
    userId: text().notNull(),
    orderId: uuid()
      .notNull()
      .references(() => order.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('coupon_redemption_order_idx').on(table.orderId), index('coupon_redemption_user_idx').on(table.couponCode, table.userId)],
);

export const payment = pgTable(
  'payment',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => order.id),
    provider: paymentProvider().notNull(),
    providerOrderId: text().notNull(),
    providerPaymentId: text(),
    status: paymentStatus().notNull().default('created'),
    amountMinor: integer().notNull(),
    currency: currency().notNull(),
    raw: jsonb(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('payment_provider_order_idx').on(table.provider, table.providerOrderId),
    index('payment_order_idx').on(table.orderId),
  ],
);

export const creditLedger = pgTable(
  'credit_ledger',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text().notNull(),
    amountMinor: integer().notNull(),
    currency: currency().notNull(),
    reason: text().notNull(),
    orderId: uuid().references(() => order.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('credit_ledger_user_idx').on(table.userId),
    uniqueIndex('credit_ledger_order_reason_idx').on(table.orderId, table.reason).where(sql`${table.orderId} is not null`),
  ],
);

export const invoice = pgTable(
  'invoice',
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid()
      .notNull()
      .references(() => order.id),
    number: text().notNull(),
    gstin: text(),
    placeOfSupply: text(),
    pdfKey: text(),
    issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('invoice_number_idx').on(table.number), uniqueIndex('invoice_order_idx').on(table.orderId)],
);
