import type { SupportChat, SupportChatSummary, SupportMessage } from '@vela/api';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { esim, profile, supportConversation, supportMessage, supportRating } from '../../db/schema';
import { HttpError, notFound } from '../../lib/errors';

export type SupportUser = { id: string; name: string; email: string | null; phone: string | null; language: string };

export type SupportDesk = {
  name: 'local';
  /** Legacy single-thread API (older app versions): the customer's most recent chat. */
  thread(user: SupportUser): Promise<SupportMessage[]>;
  send(user: SupportUser, text: string): Promise<SupportMessage[]>;
  ratingAsked(user: SupportUser): Promise<boolean>;
  rate(user: SupportUser, score: number, comment: string | null): Promise<void>;
  /** Tickets. */
  chats(user: SupportUser): Promise<SupportChatSummary[]>;
  chat(user: SupportUser, id: string): Promise<SupportChat>;
  start(user: SupportUser, text: string, iccid: string | null): Promise<SupportChat>;
  reply(user: SupportUser, id: string, text: string): Promise<SupportChat>;
  rateChat(user: SupportUser, id: string, score: number, comment: string | null): Promise<void>;
};

type ConversationRow = typeof supportConversation.$inferSelect;

const GREETING = {
  en: 'Hi, this is vela support. Ask us anything about installing or using your eSIM.',
  ar: 'مرحبًا، هنا دعم vela. اسألنا عن أي شيء يخص تثبيت شريحتك أو استخدامها.',
};

function greeting(user: SupportUser, at: Date): SupportMessage {
  return {
    id: 'welcome',
    from: 'agent',
    text: user.language.startsWith('ar') ? GREETING.ar : GREETING.en,
    sent_at: at.toISOString(),
    install_step: null,
  };
}

export async function supportUser(db: Database, userId: string, fallback: { name: string; email: string | null; phone: string | null }) {
  const [row] = await db.select().from(profile).where(eq(profile.userId, userId));
  return {
    id: userId,
    name: row?.name ?? (fallback.name === 'Traveller' ? 'Traveller' : fallback.name),
    email: row?.email ?? fallback.email,
    phone: row?.phone ?? fallback.phone,
    language: row?.language ?? 'en',
  };
}

const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

/** Records a customer message on a chat: it now waits on staff, a resolved chat reopens, and any rating request is dropped. */
export async function touchFromCustomer(db: Database, conversationId: string, at = new Date()) {
  await db
    .update(supportConversation)
    .set({ status: 'open', lastMessageAt: at, lastCustomerAt: at, resolvedAt: null, ratingRequestedAt: null })
    .where(eq(supportConversation.id, conversationId));
}

/** The eSIM label for each ICCID, for showing which plan a chat is about. */
export async function esimLabels(db: Database, iccids: (string | null)[]) {
  const wanted = [...new Set(iccids.filter((value): value is string => Boolean(value)))];
  if (wanted.length === 0) return new Map<string, string>();
  const rows = await db.select({ iccid: esim.iccid, label: esim.label }).from(esim).where(inArray(esim.iccid, wanted));
  return new Map(rows.map((row) => [row.iccid, row.label]));
}

/** Checks that an ICCID is one of this customer's eSIMs. */
export async function ownedIccid(db: Database, userId: string, iccid: string | null): Promise<string | null> {
  if (!iccid) return null;
  const [row] = await db
    .select({ iccid: esim.iccid })
    .from(esim)
    .where(and(eq(esim.iccid, iccid), eq(esim.userId, userId)));
  if (!row) throw new HttpError(422, 'unknown_esim', 'Pick one of your own eSIMs');
  return row.iccid;
}

/** Staff and the app both talk to our own database. Staff answer from the admin inbox. */
export function createSupportDesk(db: Database): SupportDesk {
  async function owned(user: SupportUser, id: string): Promise<ConversationRow> {
    if (!isUuid(id)) throw notFound('Chat');
    const [row] = await db
      .select()
      .from(supportConversation)
      .where(and(eq(supportConversation.id, id), eq(supportConversation.userId, user.id)));
    if (!row) throw notFound('Chat');
    return row;
  }

  async function latest(user: SupportUser): Promise<ConversationRow | null> {
    const [row] = await db
      .select()
      .from(supportConversation)
      .where(eq(supportConversation.userId, user.id))
      .orderBy(desc(supportConversation.lastMessageAt))
      .limit(1);
    return row ?? null;
  }

  async function messages(user: SupportUser, conversation: ConversationRow): Promise<SupportMessage[]> {
    const rows = await db
      .select()
      .from(supportMessage)
      .where(and(eq(supportMessage.conversationId, conversation.id), eq(supportMessage.internal, false)))
      .orderBy(asc(supportMessage.createdAt));
    return [
      greeting(user, rows[0]?.createdAt ?? conversation.createdAt),
      ...rows.map((row) => ({
        id: row.id,
        from: row.sender === 'agent' ? ('agent' as const) : ('user' as const),
        text: row.text,
        sent_at: row.createdAt.toISOString(),
        install_step: null,
      })),
    ];
  }

  async function summaries(rows: ConversationRow[]): Promise<SupportChatSummary[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const [last, labels] = await Promise.all([
      db
        .selectDistinctOn([supportMessage.conversationId], {
          conversationId: supportMessage.conversationId,
          text: supportMessage.text,
          sender: supportMessage.sender,
          at: supportMessage.createdAt,
        })
        .from(supportMessage)
        .where(and(inArray(supportMessage.conversationId, ids), eq(supportMessage.internal, false)))
        .orderBy(supportMessage.conversationId, desc(supportMessage.createdAt)),
      esimLabels(
        db,
        rows.map((row) => row.iccid),
      ),
    ]);
    const lastBy = new Map(last.map((item) => [item.conversationId, item]));
    return rows.map((row) => {
      const message = lastBy.get(row.id);
      return {
        id: row.id,
        number: row.number,
        status: row.status,
        esim: row.iccid ? { iccid: row.iccid, label: labels.get(row.iccid) ?? row.iccid } : null,
        last_message: message ? { text: message.text, from: message.sender === 'agent' ? 'agent' : 'user', sent_at: message.at.toISOString() } : null,
        updated_at: row.lastMessageAt.toISOString(),
        rating_asked: Boolean(row.ratingRequestedAt),
      };
    });
  }

  async function full(user: SupportUser, row: ConversationRow): Promise<SupportChat> {
    const [[summary], list] = await Promise.all([summaries([row]), messages(user, row)]);
    if (!summary) throw new Error('Chat summary missing');
    return { chat: summary, messages: list };
  }

  async function write(user: SupportUser, conversationId: string, text: string) {
    const [row] = await db.insert(supportMessage).values({ userId: user.id, conversationId, sender: 'user', text }).returning();
    await touchFromCustomer(db, conversationId, row?.createdAt);
  }

  async function create(user: SupportUser, iccid: string | null) {
    const [row] = await db.insert(supportConversation).values({ userId: user.id, iccid, status: 'open' }).returning();
    if (!row) throw new Error('Chat was not stored');
    return row;
  }

  async function rateRow(row: ConversationRow, user: SupportUser, score: number, comment: string | null) {
    const [claimed] = await db
      .update(supportConversation)
      .set({ ratingRequestedAt: null })
      .where(and(eq(supportConversation.id, row.id), sql`${supportConversation.ratingRequestedAt} is not null`))
      .returning({ assigneeId: supportConversation.assigneeId });
    if (!claimed) return;
    await db.insert(supportRating).values({ userId: user.id, conversationId: row.id, score, comment, staffId: claimed.assigneeId });
  }

  return {
    name: 'local',
    async thread(user) {
      const row = await latest(user);
      return row ? messages(user, row) : [greeting(user, new Date())];
    },
    async send(user, text) {
      const row = (await latest(user)) ?? (await create(user, null));
      await write(user, row.id, text);
      return messages(user, row);
    },
    async ratingAsked(user) {
      return Boolean((await latest(user))?.ratingRequestedAt);
    },
    async rate(user, score, comment) {
      const row = await latest(user);
      if (row) await rateRow(row, user, score, comment);
    },
    async chats(user) {
      const rows = await db
        .select()
        .from(supportConversation)
        .where(eq(supportConversation.userId, user.id))
        .orderBy(desc(supportConversation.lastMessageAt))
        .limit(50);
      return summaries(rows);
    },
    async chat(user, id) {
      return full(user, await owned(user, id));
    },
    async start(user, text, iccid) {
      const row = await create(user, await ownedIccid(db, user.id, iccid));
      await write(user, row.id, text);
      return full(user, await owned(user, row.id));
    },
    async reply(user, id, text) {
      const row = await owned(user, id);
      await write(user, row.id, text);
      return full(user, await owned(user, id));
    },
    async rateChat(user, id, score, comment) {
      await rateRow(await owned(user, id), user, score, comment);
    },
  };
}
