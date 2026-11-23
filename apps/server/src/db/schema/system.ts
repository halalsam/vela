import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { webhookSource } from './enums';

export const webhookEvent = pgTable(
  'webhook_event',
  {
    id: uuid().primaryKey().defaultRandom(),
    source: webhookSource().notNull(),
    eventId: text().notNull(),
    type: text().notNull(),
    payload: jsonb().notNull(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp({ withTimezone: true }),
    error: text(),
  },
  (table) => [uniqueIndex('webhook_event_source_id_idx').on(table.source, table.eventId)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid().primaryKey().defaultRandom(),
    actorId: text().notNull(),
    action: text().notNull(),
    target: text().notNull(),
    data: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_log_target_idx').on(table.target)],
);

export const supportContact = pgTable('support_contact', {
  userId: text().primaryKey(),
  sourceId: text().notNull(),
  conversationId: integer(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const supportMessage = pgTable(
  'support_message',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text().notNull(),
    sender: text().notNull(),
    text: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('support_message_user_idx').on(table.userId, table.createdAt)],
);
