import { createHmac } from 'node:crypto';
import type { SupportMessage } from '@vela/api';
import { asc, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { profile, supportContact, supportMessage } from '../../db/schema';
import type { Env } from '../../env';
import type { Logger } from '../../logger';

export type SupportUser = { id: string; name: string; email: string | null; phone: string | null; language: string };

export type SupportDesk = {
  name: 'chatwoot' | 'local';
  thread(user: SupportUser): Promise<SupportMessage[]>;
  send(user: SupportUser, text: string): Promise<SupportMessage[]>;
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

function localDesk(db: Database): SupportDesk {
  async function thread(user: SupportUser): Promise<SupportMessage[]> {
    const rows = await db.select().from(supportMessage).where(eq(supportMessage.userId, user.id)).orderBy(asc(supportMessage.createdAt));
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
      await db.insert(supportMessage).values({ userId: user.id, sender: 'user', text });
      return thread(user);
    },
  };
}

type ChatwootMessage = { id: number; content: string | null; message_type: number; created_at: number };

function chatwootDesk(env: Env, db: Database, logger: Logger, request: typeof fetch): SupportDesk {
  const base = `${(env.CHATWOOT_URL ?? '').replace(/\/$/, '')}/public/api/v1/inboxes/${env.CHATWOOT_INBOX_IDENTIFIER}`;

  async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const response = await request(`${base}${path}`, {
      method: init.method ?? 'GET',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (!response.ok) {
      logger.warn({ status: response.status, path }, 'Chatwoot request failed');
      throw new Error(`Chatwoot ${path} failed with ${response.status}`);
    }
    return (await response.json()) as T;
  }

  async function conversation(user: SupportUser): Promise<{ sourceId: string; conversationId: number; since: Date }> {
    let [contact] = await db.select().from(supportContact).where(eq(supportContact.userId, user.id));
    if (!contact) {
      const created = await call<{ source_id: string }>('/contacts', {
        method: 'POST',
        body: {
          identifier: user.id,
          ...(env.CHATWOOT_HMAC_TOKEN ? { identifier_hash: createHmac('sha256', env.CHATWOOT_HMAC_TOKEN).update(user.id).digest('hex') } : {}),
          name: user.name,
          ...(user.email ? { email: user.email } : {}),
          ...(user.phone ? { phone_number: user.phone } : {}),
          custom_attributes: { vela_user_id: user.id, language: user.language },
        },
      });
      [contact] = await db
        .insert(supportContact)
        .values({ userId: user.id, sourceId: created.source_id })
        .onConflictDoUpdate({ target: supportContact.userId, set: { sourceId: created.source_id } })
        .returning();
    }
    if (!contact) throw new Error('Support contact could not be stored');
    if (contact.conversationId === null) {
      const created = await call<{ id: number }>(`/contacts/${encodeURIComponent(contact.sourceId)}/conversations`, { method: 'POST', body: {} });
      await db.update(supportContact).set({ conversationId: created.id }).where(eq(supportContact.userId, user.id));
      return { sourceId: contact.sourceId, conversationId: created.id, since: contact.createdAt };
    }
    return { sourceId: contact.sourceId, conversationId: contact.conversationId, since: contact.createdAt };
  }

  async function thread(user: SupportUser): Promise<SupportMessage[]> {
    const { sourceId, conversationId, since } = await conversation(user);
    const messages = await call<ChatwootMessage[]>(`/contacts/${encodeURIComponent(sourceId)}/conversations/${conversationId}/messages`);
    return [
      greeting(user, since),
      ...messages
        .filter((item) => item.content && (item.message_type === 0 || item.message_type === 1 || item.message_type === 3))
        .map((item) => ({
          id: String(item.id),
          from: item.message_type === 0 ? ('user' as const) : ('agent' as const),
          text: item.content ?? '',
          sent_at: new Date(item.created_at * 1000).toISOString(),
          install_step: null,
        })),
    ];
  }

  return {
    name: 'chatwoot',
    thread,
    async send(user, text) {
      const { sourceId, conversationId } = await conversation(user);
      await call(`/contacts/${encodeURIComponent(sourceId)}/conversations/${conversationId}/messages`, { method: 'POST', body: { content: text } });
      return thread(user);
    },
  };
}

export function createSupportDesk(env: Env, db: Database, logger: Logger, request: typeof fetch = fetch): SupportDesk {
  return env.CHATWOOT_URL && env.CHATWOOT_INBOX_IDENTIFIER ? chatwootDesk(env, db, logger, request) : localDesk(db);
}
