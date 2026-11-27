import type { Context } from 'hono';
import type { AdminEnv } from '../auth/staff';
import { HttpError } from '../lib/errors';
import * as broadcasts from '../services/broadcasts.service';
import * as customers from '../services/customers.service';
import * as inbox from '../services/inbox.service';
import {
  audienceBody,
  blankDeep,
  broadcastBody,
  conversationPatch,
  conversationsQuery,
  customersQuery,
  dropEmpty,
  optionalDate,
  parse,
  replyBody,
  staffMessageBody,
  startConversationBody,
  tagsBody,
} from '../validators/admin.validators';

type C = Context<AdminEnv>;

const body = (c: C) => c.req.json().catch(() => null);
const id = (c: C) => c.req.param('id') ?? '';
const queueDeps = (c: C) => ({ db: c.var.deps.db, queue: c.var.deps.queue });

/* Inbox. */

export const listStaff = async (c: C) => c.json(await inbox.listStaff(c.var.deps.db));

export async function listConversations(c: C) {
  return c.json(await inbox.listConversations(c.var.deps.db, c.var.user.id, parse(conversationsQuery, dropEmpty(c.req.query()))));
}

export const stats = async (c: C) => c.json(await inbox.supportStats(c.var.deps.db));

export const getConversation = async (c: C) => c.json(await inbox.conversationDetail(c.var.deps.db, id(c), { markRead: c.req.query('read') !== '0' }));

export async function reply(c: C) {
  return c.json(await inbox.staffReply(queueDeps(c), c.var.user.id, id(c), parse(staffMessageBody, await body(c))), 201);
}

export async function updateConversation(c: C) {
  return c.json(await inbox.updateConversation(c.var.deps.db, c.var.user.id, id(c), parse(conversationPatch, await body(c))));
}

export async function startConversation(c: C) {
  return c.json(await inbox.staffStartConversation(queueDeps(c), c.var.user.id, id(c), parse(startConversationBody, await body(c))), 201);
}

export const listSavedReplies = async (c: C) => c.json(await inbox.listSavedReplies(c.var.deps.db));

export async function createSavedReply(c: C) {
  return c.json(await inbox.createSavedReply(c.var.deps.db, c.var.user.id, parse(replyBody, await body(c))), 201);
}

export async function updateSavedReply(c: C) {
  return c.json(await inbox.updateSavedReply(c.var.deps.db, id(c), parse(replyBody.partial(), await body(c))));
}

export async function deleteSavedReply(c: C) {
  await inbox.deleteSavedReply(c.var.deps.db, id(c));
  return c.body(null, 204);
}

/* Customers. */

export async function listCustomers(c: C) {
  const query = parse(customersQuery, dropEmpty(c.req.query()));
  return c.json(await customers.listCustomers(c.var.deps.db, { ...query, before: optionalDate(query.before) }));
}

export const getCustomer = async (c: C) => c.json(await customers.customerDetail(c.var.deps.db, id(c)));

export async function setTags(c: C) {
  const { tags } = parse(tagsBody, await body(c));
  return c.json({ tags: await customers.setTags(c.var.deps.db, c.var.user.id, id(c), tags) });
}

export const allTags = async (c: C) => c.json(await customers.allTags(c.var.deps.db));

/* Broadcasts. */

export const listBroadcasts = async (c: C) => c.json(await broadcasts.listBroadcasts(c.var.deps.db));

export async function audience(c: C) {
  const { segment } = parse(audienceBody, await body(c));
  return c.json(await customers.audienceSize(c.var.deps.db, segment));
}

export async function createBroadcast(c: C) {
  const input = parse(broadcastBody, blankDeep(await body(c)));
  if ((input.title_ar === null) !== (input.body_ar === null)) throw new HttpError(400, 'invalid_request', 'Give both the Arabic title and text, or neither');
  return c.json(await broadcasts.createBroadcast(queueDeps(c), c.var.user.id, input), 201);
}
