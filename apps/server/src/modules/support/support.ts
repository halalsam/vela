import type { SupportMessage } from '@vela/api';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { profile, supportConversation, supportMessage, supportRating } from '../../db/schema';

export type SupportUser = { id: string; name: string; email: string | null; phone: string | null; language: string };

export type SupportDesk = {
  name: 'local';
  thread(user: SupportUser): Promise<SupportMessage[]>;
  send(user: SupportUser, text: string): Promise<SupportMessage[]>;
  /** Whether staff resolved the chat and are waiting for a 1 to 5 rating. */
  ratingAsked(user: SupportUser): Promise<boolean>;
  rate(user: SupportUser, score: number, comment: string | null): Promise<void>;
};

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

/** Records a customer message on the conversation: it now waits on staff, and any rating request is dropped. */
export async function touchFromCustomer(db: Database, userId: string, at = new Date()) {
  await db
    .insert(supportConversation)
    .values({ userId, status: 'open', lastMessageAt: at, lastCustomerAt: at, createdAt: at })
    .onConflictDoUpdate({
      target: supportConversation.userId,
      set: { status: 'open', lastMessageAt: at, lastCustomerAt: at, resolvedAt: null, ratingRequestedAt: null },
    });
}

/** Staff and the app both talk to our own database. Staff answer from the admin inbox. */
export function createSupportDesk(db: Database): SupportDesk {
  async function thread(user: SupportUser): Promise<SupportMessage[]> {
    const rows = await db
      .select()
      .from(supportMessage)
      .where(and(eq(supportMessage.userId, user.id), eq(supportMessage.internal, false)))
      .orderBy(asc(supportMessage.createdAt));
    return [
      greeting(user, rows[0]?.createdAt ?? new Date()),
      ...rows.map((row) => ({
        id: row.id,
        from: row.sender === 'agent' ? ('agent' as const) : ('user' as const),
        text: row.text,
        sent_at: row.createdAt.toISOString(),
        install_step: null,
      })),
    ];
  }

  return {
    name: 'local',
    thread,
    async send(user, text) {
      const [row] = await db.insert(supportMessage).values({ userId: user.id, sender: 'user', text }).returning();
      await touchFromCustomer(db, user.id, row?.createdAt);
      return thread(user);
    },
    async ratingAsked(user) {
      const [row] = await db
        .select({ asked: supportConversation.ratingRequestedAt })
        .from(supportConversation)
        .where(eq(supportConversation.userId, user.id));
      return Boolean(row?.asked);
    },
    async rate(user, score, comment) {
      const [claimed] = await db
        .update(supportConversation)
        .set({ ratingRequestedAt: null })
        .where(and(eq(supportConversation.userId, user.id), sql`${supportConversation.ratingRequestedAt} is not null`))
        .returning({ assigneeId: supportConversation.assigneeId });
      if (!claimed) return;
      await db.insert(supportRating).values({ userId: user.id, score, comment, staffId: claimed.assigneeId });
    },
  };
}
