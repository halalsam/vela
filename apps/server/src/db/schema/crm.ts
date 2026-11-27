import { index, integer, jsonb, pgEnum, pgTable, primaryKey, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const conversationStatus = pgEnum('conversation_status', ['open', 'pending', 'resolved']);
export const broadcastStatus = pgEnum('broadcast_status', ['queued', 'sending', 'sent', 'failed']);

/** One support conversation per traveller. A new customer message reopens a resolved one. */
export const supportConversation = pgTable(
  'support_conversation',
  {
    userId: text().primaryKey(),
    /** open: waiting on staff. pending: waiting on the customer. resolved: done. */
    status: conversationStatus().notNull().default('open'),
    assigneeId: text(),
    lastMessageAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** When the customer last wrote. Used for "waiting since". */
    lastCustomerAt: timestamp({ withTimezone: true }),
    staffReadAt: timestamp({ withTimezone: true }),
    resolvedAt: timestamp({ withTimezone: true }),
    /** Set on resolve, cleared when the customer rates or writes again. */
    ratingRequestedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('support_conversation_status_idx').on(table.status, table.lastMessageAt)],
);

export const supportRating = pgTable(
  'support_rating',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text().notNull(),
    /** 1 to 5. */
    score: smallint().notNull(),
    comment: text(),
    /** The staff member assigned when the customer rated. */
    staffId: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('support_rating_created_idx').on(table.createdAt)],
);

export const savedReply = pgTable('saved_reply', {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  body: text().notNull(),
  createdBy: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const customerTag = pgTable(
  'customer_tag',
  {
    userId: text().notNull(),
    tag: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tag] }), index('customer_tag_tag_idx').on(table.tag)],
);

export const broadcast = pgTable('broadcast', {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  body: text().notNull(),
  /** Arabic copy for devices set to Arabic. Null sends the English text to everyone. */
  titleAr: text(),
  bodyAr: text(),
  /** The customer filter it was sent to (same shape as the customer list filter). */
  segment: jsonb().notNull(),
  status: broadcastStatus().notNull().default('queued'),
  audience: integer().notNull().default(0),
  /** Pushes delivered to at least one device. */
  reached: integer().notNull().default(0),
  createdBy: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp({ withTimezone: true }),
  error: text(),
});
