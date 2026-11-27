import { and, asc, avg, count, desc, eq, gte, inArray, isNull, ne, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../db/client';
import { customerTag, esim, profile, savedReply, supportConversation, supportMessage, supportRating } from '../db/schema';

export type ConversationRow = typeof supportConversation.$inferSelect;
export type NewConversation = typeof supportConversation.$inferInsert;
export type MessageRow = typeof supportMessage.$inferSelect;
export type RatingRow = typeof supportRating.$inferSelect;
export type SavedReplyRow = typeof savedReply.$inferSelect;
export type ConversationStatusValue = ConversationRow['status'];

/* Conversations (support chats, one per ticket). */

export async function findConversation(db: Database, id: string): Promise<ConversationRow | null> {
  const [row] = await db.select().from(supportConversation).where(eq(supportConversation.id, id));
  return row ?? null;
}

export async function findUserConversation(db: Database, userId: string, id: string): Promise<ConversationRow | null> {
  const [row] = await db
    .select()
    .from(supportConversation)
    .where(and(eq(supportConversation.id, id), eq(supportConversation.userId, userId)));
  return row ?? null;
}

export async function latestUserConversation(db: Database, userId: string): Promise<ConversationRow | null> {
  const [row] = await db
    .select()
    .from(supportConversation)
    .where(eq(supportConversation.userId, userId))
    .orderBy(desc(supportConversation.lastMessageAt))
    .limit(1);
  return row ?? null;
}

export async function userConversations(db: Database, userId: string, limit: number, exceptId?: string): Promise<ConversationRow[]> {
  return db
    .select()
    .from(supportConversation)
    .where(exceptId ? and(eq(supportConversation.userId, userId), ne(supportConversation.id, exceptId)) : eq(supportConversation.userId, userId))
    .orderBy(desc(supportConversation.lastMessageAt))
    .limit(limit);
}

export async function insertConversation(db: Database, values: NewConversation): Promise<ConversationRow> {
  const [row] = await db.insert(supportConversation).values(values).returning();
  if (!row) throw new Error('Conversation was not stored');
  return row;
}

/** Column values, or SQL such as `assignIfUnassigned`. */
export async function updateConversation(db: Database, id: string, values: { [K in keyof NewConversation]?: NewConversation[K] | SQL }): Promise<void> {
  await db.update(supportConversation).set(values).where(eq(supportConversation.id, id));
}

/** Keeps the current assignee, or assigns `staffId` when there is none. */
export const assignIfUnassigned = (staffId: string) => sql`coalesce(${supportConversation.assigneeId}, ${staffId})`;

/** Clears the rating request if one is pending; returns the assignee at that moment, or null when none was pending. */
export async function takeRatingRequest(db: Database, id: string): Promise<{ assigneeId: string | null } | null> {
  const [claimed] = await db
    .update(supportConversation)
    .set({ ratingRequestedAt: null })
    .where(and(eq(supportConversation.id, id), sql`${supportConversation.ratingRequestedAt} is not null`))
    .returning({ assigneeId: supportConversation.assigneeId });
  return claimed ?? null;
}

/** The staff inbox: waiting on staff first (longest wait on top), everything else newest first. */
export async function inboxConversations(
  db: Database,
  actorId: string,
  filter: { status?: ConversationStatusValue | 'all'; assignee?: 'me' | 'unassigned' | 'any'; q?: string; tag?: string; limit: number },
) {
  const where: SQL[] = [];
  if (filter.status && filter.status !== 'all') where.push(eq(supportConversation.status, filter.status));
  if (filter.assignee === 'me') where.push(eq(supportConversation.assigneeId, actorId));
  if (filter.assignee === 'unassigned') where.push(isNull(supportConversation.assigneeId));
  if (filter.q?.trim()) {
    const term = `%${filter.q.trim()}%`;
    where.push(
      sql`(${profile.name} ilike ${term} or ${profile.phone} ilike ${term} or ${profile.email} ilike ${term}
        or ${supportConversation.number}::text = ${filter.q.trim().replace(/^#/, '')}
        or exists (select 1 from ${supportMessage} where ${supportMessage.conversationId} = ${supportConversation.id} and ${supportMessage.text} ilike ${term}))`,
    );
  }
  if (filter.tag) {
    where.push(sql`exists (select 1 from ${customerTag} where ${customerTag.userId} = ${supportConversation.userId} and ${customerTag.tag} = ${filter.tag})`);
  }
  return db
    .select({ conversation: supportConversation, name: profile.name, phone: profile.phone, email: profile.email, language: profile.language })
    .from(supportConversation)
    .leftJoin(profile, eq(profile.userId, supportConversation.userId))
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(
      sql`case when ${supportConversation.status} = 'open' then 0 else 1 end`,
      sql`case when ${supportConversation.status} = 'open' then ${supportConversation.lastCustomerAt} end asc nulls last`,
      desc(supportConversation.lastMessageAt),
    )
    .limit(filter.limit);
}

/** The status of the chat that most needs attention for a customer: open, then pending, then resolved. */
export const mostUrgentStatus = (userId: SQL | typeof profile.userId) => sql<ConversationStatusValue | null>`(
  select ${supportConversation.status} from ${supportConversation} where ${supportConversation.userId} = ${userId}
  order by case ${supportConversation.status} when 'open' then 0 when 'pending' then 1 else 2 end limit 1
)`;

/* Messages. */

export async function insertMessage(db: Database, values: typeof supportMessage.$inferInsert): Promise<MessageRow | null> {
  const [row] = await db.insert(supportMessage).values(values).returning();
  return row ?? null;
}

export async function conversationMessages(db: Database, conversationId: string, options: { includeInternal: boolean }): Promise<MessageRow[]> {
  return db
    .select()
    .from(supportMessage)
    .where(
      options.includeInternal
        ? eq(supportMessage.conversationId, conversationId)
        : and(eq(supportMessage.conversationId, conversationId), eq(supportMessage.internal, false)),
    )
    .orderBy(asc(supportMessage.createdAt));
}

/** The newest message of each conversation. */
export async function lastMessages(db: Database, conversationIds: string[], options: { includeInternal: boolean }) {
  if (conversationIds.length === 0) return [];
  return db
    .selectDistinctOn([supportMessage.conversationId], {
      conversationId: supportMessage.conversationId,
      text: supportMessage.text,
      sender: supportMessage.sender,
      internal: supportMessage.internal,
      at: supportMessage.createdAt,
    })
    .from(supportMessage)
    .where(
      options.includeInternal
        ? inArray(supportMessage.conversationId, conversationIds)
        : and(inArray(supportMessage.conversationId, conversationIds), eq(supportMessage.internal, false)),
    )
    .orderBy(supportMessage.conversationId, desc(supportMessage.createdAt));
}

/** Customer messages staff have not read yet, per conversation. */
export async function unreadCounts(db: Database, conversationIds: string[]) {
  if (conversationIds.length === 0) return [];
  return db
    .select({ conversationId: supportMessage.conversationId, value: count() })
    .from(supportMessage)
    .innerJoin(supportConversation, eq(supportConversation.id, supportMessage.conversationId))
    .where(
      and(
        inArray(supportMessage.conversationId, conversationIds),
        eq(supportMessage.sender, 'user'),
        sql`${supportMessage.createdAt} > coalesce(${supportConversation.staffReadAt}, 'epoch'::timestamptz)`,
      ),
    )
    .groupBy(supportMessage.conversationId);
}

export async function countStaffReplies(db: Database, conversationId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(supportMessage)
    .where(and(eq(supportMessage.conversationId, conversationId), eq(supportMessage.sender, 'agent'), eq(supportMessage.internal, false)));
  return row?.value ?? 0;
}

/* Ratings. */

export async function insertRating(db: Database, values: typeof supportRating.$inferInsert): Promise<void> {
  await db.insert(supportRating).values(values);
}

export async function latestRatingFor(db: Database, conversationId: string): Promise<RatingRow | null> {
  const [row] = await db.select().from(supportRating).where(eq(supportRating.conversationId, conversationId)).orderBy(desc(supportRating.createdAt)).limit(1);
  return row ?? null;
}

export async function userRatings(db: Database, userId: string, limit: number): Promise<RatingRow[]> {
  return db.select().from(supportRating).where(eq(supportRating.userId, userId)).orderBy(desc(supportRating.createdAt)).limit(limit);
}

/* Inbox stats. */

export async function inboxCounts(db: Database, now: Date, dayMs: number) {
  const [byStatus, unassigned, resolvedToday, ratings] = await Promise.all([
    db.select({ status: supportConversation.status, value: count() }).from(supportConversation).groupBy(supportConversation.status),
    db
      .select({ value: count() })
      .from(supportConversation)
      .where(and(eq(supportConversation.status, 'open'), isNull(supportConversation.assigneeId))),
    db
      .select({ value: count() })
      .from(supportConversation)
      .where(and(eq(supportConversation.status, 'resolved'), gte(supportConversation.resolvedAt, new Date(now.getTime() - dayMs)))),
    db
      .select({ average: avg(supportRating.score), value: count() })
      .from(supportRating)
      .where(gte(supportRating.createdAt, new Date(now.getTime() - 30 * dayMs))),
  ]);
  return { byStatus, unassigned: unassigned[0]?.value ?? 0, resolvedToday: resolvedToday[0]?.value ?? 0, ratings: ratings[0] ?? null };
}

/** Customer-visible messages since `since`, grouped by conversation in time order. */
export async function messagesSince(db: Database, since: Date, limit: number) {
  return db
    .select({ conversationId: supportMessage.conversationId, sender: supportMessage.sender, at: supportMessage.createdAt })
    .from(supportMessage)
    .where(and(gte(supportMessage.createdAt, since), eq(supportMessage.internal, false)))
    .orderBy(supportMessage.conversationId, asc(supportMessage.createdAt))
    .limit(limit);
}

/* Saved replies. */

export async function allSavedReplies(db: Database): Promise<SavedReplyRow[]> {
  return db.select().from(savedReply).orderBy(asc(savedReply.title));
}

export async function insertSavedReply(db: Database, values: typeof savedReply.$inferInsert): Promise<SavedReplyRow> {
  const [row] = await db.insert(savedReply).values(values).returning();
  if (!row) throw new Error('Saved reply was not stored');
  return row;
}

export async function updateSavedReply(db: Database, id: string, values: { title?: string; body?: string }): Promise<SavedReplyRow | null> {
  const [row] = await db
    .update(savedReply)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(savedReply.id, id))
    .returning();
  return row ?? null;
}

export async function deleteSavedReply(db: Database, id: string): Promise<boolean> {
  const [row] = await db.delete(savedReply).where(eq(savedReply.id, id)).returning({ id: savedReply.id });
  return Boolean(row);
}

/* Lookups shared by the inbox and the customer views. */

/** The eSIM label for each ICCID. */
export async function esimLabels(db: Database, iccids: string[]): Promise<Map<string, string>> {
  if (iccids.length === 0) return new Map();
  const rows = await db.select({ iccid: esim.iccid, label: esim.label }).from(esim).where(inArray(esim.iccid, iccids));
  return new Map(rows.map((row) => [row.iccid, row.label]));
}

/** Display names for staff ids. */
export async function staffNames(db: Database, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select({ id: profile.userId, name: profile.name, email: profile.email }).from(profile).where(inArray(profile.userId, ids));
  return new Map(rows.map((row) => [row.id, row.name ?? row.email ?? 'Staff']));
}

export async function activeStaff(db: Database) {
  return db
    .select({ id: profile.userId, name: profile.name, email: profile.email, role: profile.role })
    .from(profile)
    .where(and(ne(profile.role, 'customer'), isNull(profile.deletedAt)))
    .orderBy(asc(profile.name));
}
