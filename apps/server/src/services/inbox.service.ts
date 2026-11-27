import type { Database } from '../db/client';
import { JOB, type JobQueue } from '../jobs/queue';
import { HttpError, notFound } from '../lib/errors';
import * as audits from '../models/audit.model';
import * as customers from '../models/customer.model';
import * as profiles from '../models/profile.model';
import * as support from '../models/support.model';
import {
  chatEsim,
  conversationHeader,
  inboxItem,
  otherChat,
  savedReplyView,
  staffMember,
  staffMessage,
} from '../views/support.view';
import { listOrders } from './admin.service';
import { esimLabels, ownedIccid } from './support.service';

export const CONVERSATION_STATUSES = ['open', 'pending', 'resolved'] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export type SupportReplyJob = { userId: string; conversationId?: string; text: string };

type ConversationRow = support.ConversationRow;
type QueueDeps = { db: Database; queue: JobQueue };

const isId = (value: string) => /^[A-Za-z0-9_-]{1,64}$/.test(value);
const isUuid = (value: string) => /^[0-9a-f-]{36}$/i.test(value);
const present = (ids: (string | null)[]) => [...new Set(ids.filter((id): id is string => Boolean(id)))];

const DAY = 86_400_000;
const STATS_MESSAGE_LIMIT = 20_000;

async function staffNames(db: Database, ids: (string | null)[]) {
  return support.staffNames(db, present(ids));
}

export async function listStaff(db: Database) {
  return (await support.activeStaff(db)).map(staffMember);
}

export async function listConversations(
  db: Database,
  actorId: string,
  filter: { status?: ConversationStatus | 'all'; assignee?: 'me' | 'unassigned' | 'any'; q?: string; tag?: string; limit: number },
) {
  const rows = await support.inboxConversations(db, actorId, filter);
  const ids = rows.map((row) => row.conversation.id);
  if (ids.length === 0) return [];
  const [latest, unread, names, labels] = await Promise.all([
    support.lastMessages(db, ids, { includeInternal: true }),
    support.unreadCounts(db, ids),
    staffNames(
      db,
      rows.map((row) => row.conversation.assigneeId),
    ),
    esimLabels(
      db,
      rows.map((row) => row.conversation.iccid),
    ),
  ]);
  const last = new Map(latest.map((item) => [item.conversationId, item]));
  const unseen = new Map(unread.map((item) => [item.conversationId, item.value]));
  return rows.map((row) =>
    inboxItem(row, { last: last.get(row.conversation.id), unread: unseen.get(row.conversation.id) ?? 0, names, labels }),
  );
}

async function conversationRow(db: Database, id: string): Promise<ConversationRow> {
  if (!isUuid(id)) throw notFound('Conversation');
  const row = await support.findConversation(db, id);
  if (!row) throw notFound('Conversation');
  return row;
}

export async function conversationDetail(db: Database, id: string, options: { markRead: boolean }) {
  const current = await conversationRow(db, id);
  const userId = current.userId;
  const person = await profiles.findProfile(db, userId);
  if (!person) throw notFound('Customer');
  if (options.markRead) await support.updateConversation(db, id, { staffReadAt: new Date() });
  const [messages, tags, orders, esims, rating, others] = await Promise.all([
    support.conversationMessages(db, id, { includeInternal: true }),
    customers.tagRows(db, [userId]),
    listOrders(db, { userId, limit: 5 }),
    customers.userEsims(db, userId, 10),
    support.latestRatingFor(db, id),
    support.userConversations(db, userId, 20, id),
  ]);
  const [names, labels] = await Promise.all([
    staffNames(db, [current.assigneeId, ...messages.map((item) => item.staffId)]),
    esimLabels(db, [current.iccid, ...others.map((item) => item.iccid)]),
  ]);
  return {
    ...conversationHeader(current, rating, names, labels),
    customer: {
      name: person.name,
      phone: person.phone,
      email: person.email,
      language: person.language,
      joined_at: person.createdAt.toISOString(),
      tags: tags.map((item) => item.tag),
    },
    messages: messages.map((item) => staffMessage(item, names)),
    other_chats: others.map((item) => otherChat(item, labels)),
    orders,
    esims: esims.map(chatEsim),
  };
}

type ReplyInput = { text: string; internal: boolean; status?: ConversationStatus };

async function writeStaffMessage(deps: QueueDeps, actorId: string, current: ConversationRow, input: ReplyInput) {
  const { db } = deps;
  const now = new Date();
  await support.insertMessage(db, {
    userId: current.userId,
    conversationId: current.id,
    sender: 'agent',
    text: input.text,
    staffId: actorId,
    internal: input.internal,
    createdAt: now,
  });
  if (input.internal) return;
  // A reply means the chat now waits on the customer, unless staff picked another status.
  const status = input.status ?? 'pending';
  const resolved = status === 'resolved';
  await support.updateConversation(db, current.id, {
    status,
    lastMessageAt: now,
    staffReadAt: now,
    assigneeId: support.assignIfUnassigned(actorId),
    resolvedAt: resolved ? now : null,
    ratingRequestedAt: resolved ? now : null,
  });
  const job: SupportReplyJob = { userId: current.userId, conversationId: current.id, text: input.text };
  await deps.queue.send(JOB.supportReply, job);
}

export async function staffReply(deps: QueueDeps, actorId: string, id: string, input: ReplyInput) {
  await writeStaffMessage(deps, actorId, await conversationRow(deps.db, id), input);
  return conversationDetail(deps.db, id, { markRead: false });
}

/** Staff open a new chat with a customer (from their profile), optionally about one of their eSIMs. */
export async function staffStartConversation(deps: QueueDeps, actorId: string, userId: string, input: ReplyInput & { iccid: string | null }) {
  if (!isId(userId)) throw notFound('Customer');
  if (!(await profiles.findProfile(deps.db, userId))) throw notFound('Customer');
  const iccid = await ownedIccid(deps.db, userId, input.iccid);
  const created = await support.insertConversation(deps.db, { userId, iccid, status: input.internal ? 'open' : 'pending', assigneeId: actorId });
  await writeStaffMessage(deps, actorId, created, input);
  await audits.audit(deps.db, actorId, 'conversation.start', `user:${userId}`, { conversation: created.id, iccid });
  return conversationDetail(deps.db, created.id, { markRead: false });
}

export async function updateConversation(
  db: Database,
  actorId: string,
  id: string,
  input: { status?: ConversationStatus; assignee_id?: string | null; iccid?: string | null },
) {
  const current = await conversationRow(db, id);
  const set: Partial<support.NewConversation> = {};
  if (input.status && input.status !== current.status) {
    set.status = input.status;
    if (input.status === 'resolved') {
      set.resolvedAt = new Date();
      // Ask for a rating only when staff actually answered.
      set.ratingRequestedAt = (await support.countStaffReplies(db, id)) > 0 ? new Date() : null;
    } else {
      set.resolvedAt = null;
      set.ratingRequestedAt = null;
    }
  }
  if (input.assignee_id !== undefined && input.assignee_id !== current.assigneeId) {
    if (input.assignee_id) {
      const role = await profiles.roleOf(db, input.assignee_id);
      if (!role || role === 'customer') throw new HttpError(422, 'not_staff', 'Assign the conversation to a staff member');
    }
    set.assigneeId = input.assignee_id;
  }
  if (input.iccid !== undefined && input.iccid !== current.iccid) set.iccid = await ownedIccid(db, current.userId, input.iccid);
  if (Object.keys(set).length > 0) {
    await support.updateConversation(db, id, set);
    await audits.audit(db, actorId, 'conversation.update', `user:${current.userId}`, { conversation: id, ...input });
  }
  return conversationDetail(db, id, { markRead: false });
}

/** Median time from a customer starting to wait to the next staff reply, per conversation. */
function medianFirstReplyMs(messages: { conversationId: string | null; sender: string; at: Date }[]): number | null {
  const waits: number[] = [];
  let conversation: string | null = '';
  let waitingFrom: Date | null = null;
  for (const message of messages) {
    if (message.conversationId !== conversation) {
      conversation = message.conversationId;
      waitingFrom = null;
    }
    if (message.sender === 'user') waitingFrom ??= message.at;
    else if (waitingFrom) {
      waits.push(message.at.getTime() - waitingFrom.getTime());
      waitingFrom = null;
    }
  }
  waits.sort((a, b) => a - b);
  return waits.length === 0 ? null : (waits[Math.floor(waits.length / 2)] ?? null);
}

/** Inbox numbers for the header: queue sizes, reply speed and ratings. */
export async function supportStats(db: Database, now = new Date()) {
  const [counted, recent] = await Promise.all([
    support.inboxCounts(db, now, DAY),
    support.messagesSince(db, new Date(now.getTime() - 7 * DAY), STATS_MESSAGE_LIMIT),
  ]);
  const median = medianFirstReplyMs(recent);
  const counts = Object.fromEntries(counted.byStatus.map((row) => [row.status, row.value]));
  const ratings = counted.ratings;
  return {
    open: counts.open ?? 0,
    pending: counts.pending ?? 0,
    unassigned: counted.unassigned,
    resolved_24h: counted.resolvedToday,
    median_first_reply_minutes: median === null ? null : Math.round(median / 60_000),
    rating_30d: ratings?.value ? { average: Math.round(Number(ratings.average) * 10) / 10, count: ratings.value } : null,
  };
}

export async function listSavedReplies(db: Database) {
  return (await support.allSavedReplies(db)).map(savedReplyView);
}

export async function createSavedReply(db: Database, actorId: string, input: { title: string; body: string }) {
  return savedReplyView(await support.insertSavedReply(db, { ...input, createdBy: actorId }));
}

export async function updateSavedReply(db: Database, id: string, input: { title?: string; body?: string }) {
  if (!isUuid(id)) throw notFound('Saved reply');
  const row = await support.updateSavedReply(db, id, input);
  if (!row) throw notFound('Saved reply');
  return savedReplyView(row);
}

export async function deleteSavedReply(db: Database, id: string) {
  if (!isUuid(id)) throw notFound('Saved reply');
  if (!(await support.deleteSavedReply(db, id))) throw notFound('Saved reply');
}
