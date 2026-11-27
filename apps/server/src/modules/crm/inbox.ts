import { and, asc, avg, count, desc, eq, gte, inArray, isNull, ne, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { auditLog, customerTag, esim, profile, savedReply, supportConversation, supportMessage, supportRating } from '../../db/schema';
import { JOB, type JobQueue } from '../../jobs/queue';
import { HttpError, notFound } from '../../lib/errors';
import { listOrders } from '../admin/admin';

export const CONVERSATION_STATUSES = ['open', 'pending', 'resolved'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export type SupportReplyJob = { userId: string; text: string };

const isId = (value: string) => /^[A-Za-z0-9_-]{1,64}$/.test(value);

async function staffNames(db: Database, ids: (string | null)[]) {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (wanted.length === 0) return new Map<string, string>();
  const rows = await db.select({ id: profile.userId, name: profile.name, email: profile.email }).from(profile).where(inArray(profile.userId, wanted));
  return new Map(rows.map((row) => [row.id, row.name ?? row.email ?? 'Staff']));
}

export async function listStaff(db: Database) {
  const rows = await db
    .select({ id: profile.userId, name: profile.name, email: profile.email, role: profile.role })
    .from(profile)
    .where(and(ne(profile.role, 'customer'), isNull(profile.deletedAt)))
    .orderBy(asc(profile.name));
  return rows.map((row) => ({ user_id: row.id, name: row.name ?? row.email ?? 'Staff', role: row.role }));
}

export async function listConversations(
  db: Database,
  actorId: string,
  filter: { status?: ConversationStatus | 'all'; assignee?: 'me' | 'unassigned' | 'any'; q?: string; tag?: string; limit: number },
) {
  const where: SQL[] = [];
  if (filter.status && filter.status !== 'all') where.push(eq(supportConversation.status, filter.status));
  if (filter.assignee === 'me') where.push(eq(supportConversation.assigneeId, actorId));
  if (filter.assignee === 'unassigned') where.push(isNull(supportConversation.assigneeId));
  if (filter.q?.trim()) {
    const term = `%${filter.q.trim()}%`;
    where.push(
      sql`(${profile.name} ilike ${term} or ${profile.phone} ilike ${term} or ${profile.email} ilike ${term}
        or exists (select 1 from ${supportMessage} where ${supportMessage.userId} = ${supportConversation.userId} and ${supportMessage.text} ilike ${term}))`,
    );
  }
  if (filter.tag) {
    where.push(sql`exists (select 1 from ${customerTag} where ${customerTag.userId} = ${supportConversation.userId} and ${customerTag.tag} = ${filter.tag})`);
  }
  const rows = await db
    .select({ conversation: supportConversation, name: profile.name, phone: profile.phone, email: profile.email, language: profile.language })
    .from(supportConversation)
    .leftJoin(profile, eq(profile.userId, supportConversation.userId))
    .where(where.length > 0 ? and(...where) : undefined)
    // Waiting on staff first, longest wait at the top; everything else newest first.
    .orderBy(
      sql`case when ${supportConversation.status} = 'open' then 0 else 1 end`,
      sql`case when ${supportConversation.status} = 'open' then ${supportConversation.lastCustomerAt} end asc nulls last`,
      desc(supportConversation.lastMessageAt),
    )
    .limit(filter.limit);
  const ids = rows.map((row) => row.conversation.userId);
  if (ids.length === 0) return [];
  const [latest, unread, names] = await Promise.all([
    db
      .selectDistinctOn([supportMessage.userId], {
        userId: supportMessage.userId,
        text: supportMessage.text,
        sender: supportMessage.sender,
        internal: supportMessage.internal,
        at: supportMessage.createdAt,
      })
      .from(supportMessage)
      .where(inArray(supportMessage.userId, ids))
      .orderBy(supportMessage.userId, desc(supportMessage.createdAt)),
    db
      .select({ userId: supportMessage.userId, value: count() })
      .from(supportMessage)
      .innerJoin(supportConversation, eq(supportConversation.userId, supportMessage.userId))
      .where(
        and(
          inArray(supportMessage.userId, ids),
          eq(supportMessage.sender, 'user'),
          sql`${supportMessage.createdAt} > coalesce(${supportConversation.staffReadAt}, 'epoch'::timestamptz)`,
        ),
      )
      .groupBy(supportMessage.userId),
    staffNames(
      db,
      rows.map((row) => row.conversation.assigneeId),
    ),
  ]);
  const last = new Map(latest.map((item) => [item.userId, item]));
  const unseen = new Map(unread.map((item) => [item.userId, item.value]));
  return rows.map((row) => {
    const message = last.get(row.conversation.userId);
    return {
      user_id: row.conversation.userId,
      customer: { name: row.name, phone: row.phone, email: row.email, language: row.language ?? 'en' },
      status: row.conversation.status,
      assignee: row.conversation.assigneeId ? { user_id: row.conversation.assigneeId, name: names.get(row.conversation.assigneeId) ?? 'Staff' } : null,
      last_message: message
        ? { text: message.text, from: message.sender === 'agent' ? 'agent' : 'user', internal: message.internal, at: message.at.toISOString() }
        : null,
      unread: unseen.get(row.conversation.userId) ?? 0,
      waiting_since: row.conversation.status === 'open' ? (row.conversation.lastCustomerAt?.toISOString() ?? null) : null,
      last_message_at: row.conversation.lastMessageAt.toISOString(),
    };
  });
}

export async function conversationDetail(db: Database, userId: string, options: { markRead: boolean }) {
  if (!isId(userId)) throw notFound('Conversation');
  const [person] = await db.select().from(profile).where(eq(profile.userId, userId));
  if (!person) throw notFound('Customer');
  if (options.markRead) await db.update(supportConversation).set({ staffReadAt: new Date() }).where(eq(supportConversation.userId, userId));
  const [[conversation], messages, tags, orders, esims, ratings] = await Promise.all([
    db.select().from(supportConversation).where(eq(supportConversation.userId, userId)),
    db.select().from(supportMessage).where(eq(supportMessage.userId, userId)).orderBy(asc(supportMessage.createdAt)),
    db.select({ tag: customerTag.tag }).from(customerTag).where(eq(customerTag.userId, userId)).orderBy(asc(customerTag.tag)),
    listOrders(db, { userId, limit: 5 }),
    db.select().from(esim).where(eq(esim.userId, userId)).orderBy(desc(esim.createdAt)).limit(5),
    db.select().from(supportRating).where(eq(supportRating.userId, userId)).orderBy(desc(supportRating.createdAt)).limit(1),
  ]);
  const names = await staffNames(db, [conversation?.assigneeId ?? null, ...messages.map((item) => item.staffId)]);
  return {
    user_id: userId,
    status: conversation?.status ?? null,
    assignee: conversation?.assigneeId ? { user_id: conversation.assigneeId, name: names.get(conversation.assigneeId) ?? 'Staff' } : null,
    resolved_at: conversation?.resolvedAt?.toISOString() ?? null,
    rating_requested: Boolean(conversation?.ratingRequestedAt),
    last_rating: ratings[0] ? { score: ratings[0].score, comment: ratings[0].comment, at: ratings[0].createdAt.toISOString() } : null,
    customer: {
      name: person.name,
      phone: person.phone,
      email: person.email,
      language: person.language,
      joined_at: person.createdAt.toISOString(),
      tags: tags.map((item) => item.tag),
    },
    messages: messages.map((item) => ({
      id: item.id,
      from: item.sender === 'agent' ? ('agent' as const) : ('user' as const),
      text: item.text,
      internal: item.internal,
      staff: item.staffId ? { user_id: item.staffId, name: names.get(item.staffId) ?? 'Staff' } : null,
      at: item.createdAt.toISOString(),
    })),
    orders,
    esims: esims.map((item) => ({
      iccid: item.iccid,
      label: item.label,
      status: item.status,
      data_used_mb: item.dataUsedMb,
      data_total_mb: item.dataTotalMb,
      expires_at: item.expiresAt?.toISOString() ?? null,
    })),
  };
}

export async function staffReply(
  deps: { db: Database; queue: JobQueue },
  actorId: string,
  userId: string,
  input: { text: string; internal: boolean; status?: ConversationStatus },
) {
  const { db } = deps;
  if (!isId(userId)) throw notFound('Customer');
  const [person] = await db.select({ id: profile.userId }).from(profile).where(eq(profile.userId, userId));
  if (!person) throw notFound('Customer');
  const now = new Date();
  await db.insert(supportMessage).values({ userId, sender: 'agent', text: input.text, staffId: actorId, internal: input.internal, createdAt: now });
  if (input.internal) {
    await db
      .insert(supportConversation)
      .values({ userId, status: 'open', lastMessageAt: now, createdAt: now })
      .onConflictDoNothing();
  } else {
    // A reply means the conversation now waits on the customer, unless staff picked another status.
    const status = input.status ?? 'pending';
    const resolved = status === 'resolved';
    await db
      .insert(supportConversation)
      .values({ userId, status, assigneeId: actorId, lastMessageAt: now, staffReadAt: now, createdAt: now, resolvedAt: resolved ? now : null, ratingRequestedAt: resolved ? now : null })
      .onConflictDoUpdate({
        target: supportConversation.userId,
        set: {
          status,
          lastMessageAt: now,
          staffReadAt: now,
          assigneeId: sql`coalesce(${supportConversation.assigneeId}, ${actorId})`,
          resolvedAt: resolved ? now : null,
          ratingRequestedAt: resolved ? now : null,
        },
      });
    const job: SupportReplyJob = { userId, text: input.text };
    await deps.queue.send(JOB.supportReply, job);
  }
  return conversationDetail(db, userId, { markRead: false });
}

export async function updateConversation(
  db: Database,
  actorId: string,
  userId: string,
  input: { status?: ConversationStatus; assignee_id?: string | null },
) {
  const [current] = await db.select().from(supportConversation).where(eq(supportConversation.userId, userId));
  if (!current) throw notFound('Conversation');
  const set: Partial<typeof supportConversation.$inferInsert> = {};
  if (input.status && input.status !== current.status) {
    set.status = input.status;
    if (input.status === 'resolved') {
      set.resolvedAt = new Date();
      // Ask for a rating only when staff actually answered.
      const [answered] = await db
        .select({ value: count() })
        .from(supportMessage)
        .where(and(eq(supportMessage.userId, userId), eq(supportMessage.sender, 'agent'), eq(supportMessage.internal, false)));
      set.ratingRequestedAt = (answered?.value ?? 0) > 0 ? new Date() : null;
    } else {
      set.resolvedAt = null;
      set.ratingRequestedAt = null;
    }
  }
  if (input.assignee_id !== undefined && input.assignee_id !== current.assigneeId) {
    if (input.assignee_id) {
      const [staff] = await db.select({ role: profile.role }).from(profile).where(eq(profile.userId, input.assignee_id));
      if (!staff || staff.role === 'customer') throw new HttpError(422, 'not_staff', 'Assign the conversation to a staff member');
    }
    set.assigneeId = input.assignee_id;
  }
  if (Object.keys(set).length > 0) {
    await db.update(supportConversation).set(set).where(eq(supportConversation.userId, userId));
    await db.insert(auditLog).values({ actorId, action: 'conversation.update', target: `user:${userId}`, data: input });
  }
  return conversationDetail(db, userId, { markRead: false });
}

const DAY = 86_400_000;

/** Inbox numbers for the header: queue sizes, reply speed and ratings. */
export async function supportStats(db: Database, now = new Date()) {
  const week = new Date(now.getTime() - 7 * DAY);
  const [byStatus, unassigned, resolvedToday, ratings, recent] = await Promise.all([
    db.select({ status: supportConversation.status, value: count() }).from(supportConversation).groupBy(supportConversation.status),
    db
      .select({ value: count() })
      .from(supportConversation)
      .where(and(eq(supportConversation.status, 'open'), isNull(supportConversation.assigneeId))),
    db
      .select({ value: count() })
      .from(supportConversation)
      .where(and(eq(supportConversation.status, 'resolved'), gte(supportConversation.resolvedAt, new Date(now.getTime() - DAY)))),
    db
      .select({ average: avg(supportRating.score), value: count() })
      .from(supportRating)
      .where(gte(supportRating.createdAt, new Date(now.getTime() - 30 * DAY))),
    db
      .select({ userId: supportMessage.userId, sender: supportMessage.sender, at: supportMessage.createdAt })
      .from(supportMessage)
      .where(and(gte(supportMessage.createdAt, week), eq(supportMessage.internal, false)))
      .orderBy(supportMessage.userId, asc(supportMessage.createdAt))
      .limit(20_000),
  ]);
  // First reply: from the first customer message after an agent message (or the start) to the next agent message.
  const waits: number[] = [];
  let user = '';
  let waitingFrom: Date | null = null;
  for (const message of recent) {
    if (message.userId !== user) {
      user = message.userId;
      waitingFrom = null;
    }
    if (message.sender === 'user') waitingFrom ??= message.at;
    else if (waitingFrom) {
      waits.push(message.at.getTime() - waitingFrom.getTime());
      waitingFrom = null;
    }
  }
  waits.sort((a, b) => a - b);
  const median = waits.length === 0 ? null : (waits[Math.floor(waits.length / 2)] ?? null);
  const counts = Object.fromEntries(byStatus.map((row) => [row.status, row.value]));
  return {
    open: counts.open ?? 0,
    pending: counts.pending ?? 0,
    unassigned: unassigned[0]?.value ?? 0,
    resolved_24h: resolvedToday[0]?.value ?? 0,
    median_first_reply_minutes: median === null ? null : Math.round(median / 60_000),
    rating_30d: ratings[0]?.value ? { average: Math.round(Number(ratings[0].average) * 10) / 10, count: ratings[0].value } : null,
  };
}

export async function listSavedReplies(db: Database) {
  const rows = await db.select().from(savedReply).orderBy(asc(savedReply.title));
  return rows.map(replyOut);
}

function replyOut(row: typeof savedReply.$inferSelect) {
  return { id: row.id, title: row.title, body: row.body, updated_at: row.updatedAt.toISOString() };
}

export async function createSavedReply(db: Database, actorId: string, input: { title: string; body: string }) {
  const [row] = await db.insert(savedReply).values({ ...input, createdBy: actorId }).returning();
  if (!row) throw new Error('Saved reply was not stored');
  return replyOut(row);
}

export async function updateSavedReply(db: Database, id: string, input: { title?: string; body?: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound('Saved reply');
  const [row] = await db
    .update(savedReply)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(savedReply.id, id))
    .returning();
  if (!row) throw notFound('Saved reply');
  return replyOut(row);
}

export async function deleteSavedReply(db: Database, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound('Saved reply');
  const [row] = await db.delete(savedReply).where(eq(savedReply.id, id)).returning({ id: savedReply.id });
  if (!row) throw notFound('Saved reply');
}

