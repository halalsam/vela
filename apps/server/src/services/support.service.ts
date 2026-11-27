import type { SupportChat, SupportChatSummary, SupportMessage } from '@vela/api';
import type { Database } from '../db/client';
import { HttpError, notFound } from '../lib/errors';
import * as esims from '../models/esim.model';
import * as profiles from '../models/profile.model';
import * as support from '../models/support.model';
import { chatSummary, customerMessage, greetingMessage } from '../views/support.view';

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

type ConversationRow = support.ConversationRow;

const CHAT_LIST_LIMIT = 50;
const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);

export async function supportUser(db: Database, userId: string, fallback: { name: string; email: string | null; phone: string | null }): Promise<SupportUser> {
  const row = await profiles.findProfile(db, userId);
  return {
    id: userId,
    name: row?.name ?? (fallback.name === 'Traveller' ? 'Traveller' : fallback.name),
    email: row?.email ?? fallback.email,
    phone: row?.phone ?? fallback.phone,
    language: row?.language ?? 'en',
  };
}

/** Records a customer message on a chat: it now waits on staff, a resolved chat reopens, and any rating request is dropped. */
export async function touchFromCustomer(db: Database, conversationId: string, at = new Date()) {
  await support.updateConversation(db, conversationId, { status: 'open', lastMessageAt: at, lastCustomerAt: at, resolvedAt: null, ratingRequestedAt: null });
}

/** The eSIM label for each ICCID, for showing which plan a chat is about. */
export async function esimLabels(db: Database, iccids: (string | null)[]) {
  return support.esimLabels(db, [...new Set(iccids.filter((value): value is string => Boolean(value)))]);
}

/** Checks that an ICCID is one of this customer's eSIMs. */
export async function ownedIccid(db: Database, userId: string, iccid: string | null): Promise<string | null> {
  if (!iccid) return null;
  const row = await esims.findUserEsim(db, userId, iccid);
  if (!row) throw new HttpError(422, 'unknown_esim', 'Pick one of your own eSIMs');
  return row.iccid;
}

/** Staff and the app both talk to our own database. Staff answer from the admin inbox. */
export function createSupportDesk(db: Database): SupportDesk {
  async function owned(user: SupportUser, id: string): Promise<ConversationRow> {
    if (!isUuid(id)) throw notFound('Chat');
    const row = await support.findUserConversation(db, user.id, id);
    if (!row) throw notFound('Chat');
    return row;
  }

  async function messages(user: SupportUser, conversation: ConversationRow): Promise<SupportMessage[]> {
    const rows = await support.conversationMessages(db, conversation.id, { includeInternal: false });
    return [greetingMessage(user.language, rows[0]?.createdAt ?? conversation.createdAt), ...rows.map(customerMessage)];
  }

  async function summaries(rows: ConversationRow[]): Promise<SupportChatSummary[]> {
    if (rows.length === 0) return [];
    const [last, labels] = await Promise.all([
      support.lastMessages(
        db,
        rows.map((row) => row.id),
        { includeInternal: false },
      ),
      esimLabels(
        db,
        rows.map((row) => row.iccid),
      ),
    ]);
    const lastBy = new Map(last.map((item) => [item.conversationId, item]));
    return rows.map((row) => chatSummary(row, lastBy.get(row.id), labels));
  }

  async function full(user: SupportUser, row: ConversationRow): Promise<SupportChat> {
    const [[summary], list] = await Promise.all([summaries([row]), messages(user, row)]);
    if (!summary) throw new Error('Chat summary missing');
    return { chat: summary, messages: list };
  }

  async function write(user: SupportUser, conversationId: string, text: string) {
    const row = await support.insertMessage(db, { userId: user.id, conversationId, sender: 'user', text });
    await touchFromCustomer(db, conversationId, row?.createdAt);
  }

  async function create(user: SupportUser, iccid: string | null) {
    return support.insertConversation(db, { userId: user.id, iccid, status: 'open' });
  }

  async function rateRow(row: ConversationRow, user: SupportUser, score: number, comment: string | null) {
    const claimed = await support.takeRatingRequest(db, row.id);
    if (!claimed) return;
    await support.insertRating(db, { userId: user.id, conversationId: row.id, score, comment, staffId: claimed.assigneeId });
  }

  const latest = (user: SupportUser) => support.latestUserConversation(db, user.id);

  return {
    name: 'local',
    async thread(user) {
      const row = await latest(user);
      return row ? messages(user, row) : [greetingMessage(user.language, new Date())];
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
      return summaries(await support.userConversations(db, user.id, CHAT_LIST_LIMIT));
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
