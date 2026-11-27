import type { SupportChat, SupportChatSummary, SupportMessage } from '@vela/api';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { broadcast, esim, plan, profile, user } from '../src/db/schema';
import { seedReferenceData } from '../src/db/seed';
import { syncCatalog } from '../src/services/catalogSync.service';
import { createMockProvider } from '../src/integrations/esims/mock';
import { JOB } from '../src/jobs/queue';
import { broadcastJob, supportReplyJob } from '../src/jobs/registry';
import { createMemoryPush } from '../src/integrations/push';
import { createTestApp, createTestDb, signInWithPhone, silentLogger, testEnv } from './helpers';

let db: Awaited<ReturnType<typeof createTestDb>>['db'];
let close: () => Promise<void>;
let harness: ReturnType<typeof createTestApp>;
let traveller: string;
let other: string;
let agent: string;
let admin: string;
let travellerId: string;
let agentId: string;
let chatId: string;

const headers = (bearer: string) => ({ authorization: `Bearer ${bearer}`, 'content-type': 'application/json' });
const call = (method: string, path: string, bearer: string, body?: unknown) =>
  harness.app.request(path, { method, headers: headers(bearer), body: body === undefined ? undefined : JSON.stringify(body) });
const json = async <T>(response: Response | Promise<Response>) => (await (await response).json()) as T;

async function idOf(phone: string) {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.phoneNumber, phone));
  return row?.id ?? '';
}

type Conversation = {
  status: string | null;
  assignee: { user_id: string; name: string } | null;
  rating_requested: boolean;
  messages: { from: string; text: string; internal: boolean; staff: { name: string } | null }[];
};
type Row = { id: string; number: number; user_id: string; status: string; unread: number; assignee: unknown; last_message: { text: string } | null };

beforeAll(async () => {
  const test = await createTestDb();
  db = test.db;
  close = () => test.client.close();
  harness = createTestApp(db);
  traveller = await signInWithPhone(harness, '+919855500001');
  other = await signInWithPhone(harness, '+919855500002');
  agent = await signInWithPhone(harness, '+919855500003');
  admin = await signInWithPhone(harness, '+919855500004');
  travellerId = await idOf('+919855500001');
  agentId = await idOf('+919855500003');
  await db.update(profile).set({ role: 'support', name: 'Aisha' }).where(eq(profile.userId, agentId));
  await db.update(profile).set({ role: 'admin' }).where(eq(profile.userId, await idOf('+919855500004')));
  await db.update(profile).set({ name: 'Ravi Kumar', language: 'ar' }).where(eq(profile.userId, travellerId));
});

afterAll(async () => {
  await close();
});

describe('support inbox', () => {
  it('is staff only', async () => {
    expect((await call('GET', '/v1/admin/conversations', traveller)).status).toBe(403);
    expect((await call('GET', '/v1/admin/customers', traveller)).status).toBe(403);
  });

  it('opens a conversation when a traveller writes and counts it unread', async () => {
    await call('POST', '/v1/support/messages', traveller, { text: 'No data in Tokyo' });
    const rows = await json<Row[]>(call('GET', '/v1/admin/conversations?status=open', agent));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ user_id: travellerId, number: 1001, status: 'open', unread: 1, assignee: null, last_message: { text: 'No data in Tokyo' } });
    chatId = rows[0]?.id ?? '';
    const stats = await json<{ open: number; unassigned: number }>(call('GET', '/v1/admin/conversations/stats', agent));
    expect(stats).toMatchObject({ open: 1, unassigned: 1 });
  });

  it('keeps notes private, sends replies with a push and assigns whoever answered', async () => {
    const opened = await json<Conversation>(call('GET', `/v1/admin/conversations/${chatId}`, agent));
    expect(opened.messages.map((item) => item.text)).toEqual(['No data in Tokyo']);
    expect((await json<Row[]>(call('GET', '/v1/admin/conversations', agent)))[0]?.unread).toBe(0);

    await call('POST', `/v1/admin/conversations/${chatId}/messages`, agent, { text: 'Paid for 10GB, check roaming', internal: true });
    const replied = await json<Conversation>(
      call('POST', `/v1/admin/conversations/${chatId}/messages`, agent, { text: 'Turn on Data Roaming in Settings.' }),
    );
    expect(replied).toMatchObject({ status: 'pending', assignee: { user_id: agentId, name: 'Aisha' } });
    expect(replied.messages.map((item) => [item.from, item.internal, item.staff?.name ?? null])).toEqual([
      ['user', false, null],
      ['agent', true, 'Aisha'],
      ['agent', false, 'Aisha'],
    ]);

    const thread = await json<SupportMessage[]>(call('GET', '/v1/support/messages', traveller));
    expect(thread.map((item) => item.text).slice(1)).toEqual(['No data in Tokyo', 'Turn on Data Roaming in Settings.']);

    const queued = harness.queue.sent.filter((item) => item.name === JOB.supportReply);
    expect(queued).toEqual([{ name: JOB.supportReply, data: { userId: travellerId, conversationId: chatId, text: 'Turn on Data Roaming in Settings.' } }]);
  });

  it('pushes the reply in the traveller’s language', async () => {
    await call('POST', '/v1/devices', traveller, { platform: 'ios', push_token: 'a'.repeat(64), locale: 'ar' });
    const push = createMemoryPush();
    const job = harness.queue.sent.find((item) => item.name === JOB.supportReply);
    await supportReplyJob.handle([{ data: job?.data } as never], { db, logger: silentLogger, push } as never);
    expect(push.sent).toEqual([
      expect.objectContaining({ message: { title: 'ردّ فريق دعم vela', body: 'Turn on Data Roaming in Settings.', data: { kind: 'support', conversation_id: chatId } } }),
    ]);
  });

  it('asks for a rating on resolve, takes one, and reopens on the next message', async () => {
    expect(await json(call('GET', '/v1/support/rating', traveller))).toEqual({ asked: false });
    const resolved = await json<Conversation>(call('PATCH', `/v1/admin/conversations/${chatId}`, agent, { status: 'resolved' }));
    expect(resolved).toMatchObject({ status: 'resolved', rating_requested: true });
    expect(await json(call('GET', '/v1/support/rating', traveller))).toEqual({ asked: true });

    expect((await call('POST', '/v1/support/rating', traveller, { score: 6 })).status).toBe(400);
    expect((await call('POST', '/v1/support/rating', traveller, { score: 5, comment: 'Fixed in a minute' })).status).toBe(204);
    expect(await json(call('GET', '/v1/support/rating', traveller))).toEqual({ asked: false });
    const stats = await json<{ rating_30d: unknown }>(call('GET', '/v1/admin/conversations/stats', agent));
    expect(stats.rating_30d).toEqual({ average: 5, count: 1 });
    // A second rating without a new request is ignored.
    await call('POST', '/v1/support/rating', traveller, { score: 1 });
    expect((await json<{ rating_30d: unknown }>(call('GET', '/v1/admin/conversations/stats', agent))).rating_30d).toEqual({ average: 5, count: 1 });

    await call('POST', '/v1/support/messages', traveller, { text: 'It stopped again' });
    expect((await json<Row[]>(call('GET', '/v1/admin/conversations?status=open', agent)))[0]).toMatchObject({ status: 'open', unread: 1 });
  });

  it('only assigns to staff', async () => {
    const otherId = await idOf('+919855500002');
    expect((await call('PATCH', `/v1/admin/conversations/${chatId}`, agent, { assignee_id: otherId })).status).toBe(422);
    const mine = await json<Row[]>(call('GET', '/v1/admin/conversations?assignee=me&status=all', agent));
    expect(mine.map((item) => item.id)).toEqual([chatId]);
    await call('PATCH', `/v1/admin/conversations/${chatId}`, agent, { assignee_id: null });
    expect(await json<Row[]>(call('GET', '/v1/admin/conversations?assignee=me&status=all', agent))).toEqual([]);
  });

  it('keeps saved replies; only admins delete them', async () => {
    const created = await json<{ id: string }>(call('POST', '/v1/admin/saved-replies', agent, { title: 'Roaming', body: 'Turn on Data Roaming.' }));
    expect((await call('DELETE', `/v1/admin/saved-replies/${created.id}`, agent)).status).toBe(403);
    expect((await call('PATCH', `/v1/admin/saved-replies/${created.id}`, agent, { body: 'Settings › Mobile › Data Roaming' })).status).toBe(200);
    expect(await json(call('GET', '/v1/admin/saved-replies', agent))).toEqual([expect.objectContaining({ title: 'Roaming', body: 'Settings › Mobile › Data Roaming' })]);
    expect((await call('DELETE', `/v1/admin/saved-replies/${created.id}`, admin)).status).toBe(204);
  });
});

describe('customers', () => {
  it('lists customers but not staff, with search, tags and filters', async () => {
    const all = await json<{ total: number; customers: { user_id: string }[] }>(call('GET', '/v1/admin/customers', agent));
    expect(all.total).toBe(2);
    expect(all.customers.map((item) => item.user_id)).not.toContain(agentId);

    const tagged = await json<{ tags: string[] }>(call('PUT', `/v1/admin/customers/${travellerId}/tags`, agent, { tags: ['VIP', ' had  issue ', 'vip'] }));
    expect(tagged.tags).toEqual(['had issue', 'vip']);
    expect((await call('PUT', `/v1/admin/customers/${travellerId}/tags`, agent, { tags: ['no!'] })).status).toBe(422);

    const byTag = await json<{ customers: { user_id: string; tags: string[] }[] }>(call('GET', '/v1/admin/customers?tag=vip', agent));
    expect(byTag.customers).toEqual([expect.objectContaining({ user_id: travellerId, tags: ['had issue', 'vip'] })]);
    const byName = await json<{ customers: unknown[] }>(call('GET', '/v1/admin/customers?q=ravi', agent));
    expect(byName.customers).toHaveLength(1);
    const arabic = await json<{ customers: unknown[] }>(call('GET', '/v1/admin/customers?language=ar', agent));
    expect(arabic.customers).toHaveLength(1);
    const neverBought = await json<{ total: number }>(call('GET', '/v1/admin/customers?activity=never_bought&q=', agent));
    expect(neverBought.total).toBe(2);
    expect(await json(call('GET', '/v1/admin/tags', agent))).toEqual([
      { tag: 'had issue', customers: 1 },
      { tag: 'vip', customers: 1 },
    ]);
  });

  it('shows a customer profile with chat, ratings and staff history', async () => {
    const detail = await json<{ name: string; tags: string[]; conversations: { status: string }[]; ratings: { score: number }[]; history: { action: string }[]; devices: unknown[] }>(
      call('GET', `/v1/admin/customers/${travellerId}`, agent),
    );
    expect(detail).toMatchObject({ name: 'Ravi Kumar', tags: ['had issue', 'vip'], conversations: [{ status: 'open' }], ratings: [{ score: 5 }] });
    expect(detail.devices).toHaveLength(1);
    expect(detail.history.map((item) => item.action)).toContain('customer.tags');
    expect((await call('GET', '/v1/admin/customers/nobody', agent)).status).toBe(404);
  });

  it('counts the friends a customer referred', async () => {
    // A paid referral stores the referrer's user id on the friend's profile.
    await db.update(profile).set({ referredBy: travellerId }).where(eq(profile.userId, await idOf('+919855500002')));
    const detail = await json<{ referrals: number }>(call('GET', `/v1/admin/customers/${travellerId}`, agent));
    expect(detail.referrals).toBe(1);
    await db.update(profile).set({ referredBy: null }).where(eq(profile.userId, await idOf('+919855500002')));
  });
});

describe('broadcasts', () => {
  it('counts the audience, lets only admins send, and pushes to reachable customers', async () => {
    const size = await json(call('POST', '/v1/admin/broadcasts/audience', agent, { segment: { language: 'ar', q: '' } }));
    expect(size).toEqual({ customers: 1, reachable: 1 });
    const message = { title: 'Eid offer', body: '20% off Gulf plans', title_ar: 'عرض العيد', body_ar: 'خصم 20٪', segment: { tag: 'vip' } };
    expect((await call('POST', '/v1/admin/broadcasts', agent, message)).status).toBe(403);
    expect((await call('POST', '/v1/admin/broadcasts', admin, { ...message, body_ar: '' })).status).toBe(400);

    const created = await json<{ id: string; audience: number; status: string }>(call('POST', '/v1/admin/broadcasts', admin, message));
    expect(created).toMatchObject({ audience: 1, status: 'queued' });
    expect(harness.queue.sent.at(-1)).toEqual({ name: JOB.broadcast, data: { broadcastId: created.id } });

    const push = createMemoryPush();
    const job = { db, env: testEnv, logger: silentLogger, push };
    await broadcastJob.handle([{ data: { broadcastId: created.id } } as never], job as never);
    expect(push.sent).toEqual([expect.objectContaining({ message: { title: 'عرض العيد', body: 'خصم 20٪', data: { kind: 'broadcast', broadcast_id: created.id } } })]);
    const [row] = await db.select().from(broadcast).where(eq(broadcast.id, created.id));
    expect(row).toMatchObject({ status: 'sent', reached: 1 });
    // Running it again sends nothing more.
    await broadcastJob.handle([{ data: { broadcastId: created.id } } as never], job as never);
    expect(push.sent).toHaveLength(1);

    const listed = await json<{ id: string; status: string }[]>(call('GET', '/v1/admin/broadcasts', agent));
    expect(listed[0]).toMatchObject({ id: created.id, status: 'sent' });
    void other;
  });
});

describe('support chats (tickets)', () => {
  const japan = '8981100022233344455';
  const strangers = '8981100022233399999';

  beforeAll(async () => {
    await seedReferenceData(db, { sampleContent: false });
    await syncCatalog(db, createMockProvider(), { marginPercent: 40, logger: silentLogger });
    const [anyPlan] = await db.select({ id: plan.id }).from(plan).limit(1);
    const otherId = await idOf('+919855500002');
    const row = (userId: string, iccid: string) => ({
      userId,
      iccid,
      planId: anyPlan?.id ?? '',
      providerRef: `ref-${iccid}`,
      label: 'Japan · 10 GB',
      dataTotalMb: 10_240,
      smdp: 'smdp.example.com',
      lpaEnc: 'x',
      activationCodeEnc: 'x',
    });
    await db.insert(esim).values([row(travellerId, japan), row(otherId, strangers)]);
  });

  it('lists the existing chat and starts a new one about a plan', async () => {
    const before = await json<SupportChatSummary[]>(call('GET', '/v1/support/chats', traveller));
    expect(before.map((item) => item.number)).toEqual([1001]);

    expect((await call('POST', '/v1/support/chats', traveller, { text: 'Hi', iccid: strangers })).status).toBe(422);
    const started = await call('POST', '/v1/support/chats', traveller, { text: 'Can I top up the Japan plan?', iccid: japan });
    expect(started.status).toBe(201);
    const chat = (await started.json()) as SupportChat;
    expect(chat.chat).toMatchObject({ number: 1002, status: 'open', esim: { iccid: japan, label: 'Japan · 10 GB' }, rating_asked: false });
    expect(chat.messages.map((item) => item.text).slice(1)).toEqual(['Can I top up the Japan plan?']);

    const after = await json<SupportChatSummary[]>(call('GET', '/v1/support/chats', traveller));
    expect(after.map((item) => item.number)).toEqual([1002, 1001]);
    // The old single-thread endpoints follow the most recent chat.
    const legacy = await json<SupportMessage[]>(call('GET', '/v1/support/messages', traveller));
    expect(legacy.at(-1)?.text).toBe('Can I top up the Japan plan?');
  });

  it('keeps each chat’s messages, ratings and staff work separate', async () => {
    const [newest] = await json<SupportChatSummary[]>(call('GET', '/v1/support/chats', traveller));
    const id = newest?.id ?? '';
    const rows = await json<(Row & { esim: { label: string } | null })[]>(call('GET', '/v1/admin/conversations?status=open', agent));
    expect(rows.map((item) => item.number).sort()).toEqual([1001, 1002]);
    expect(rows.find((item) => item.id === id)?.esim).toEqual({ iccid: japan, label: 'Japan · 10 GB' });

    await call('POST', `/v1/admin/conversations/${id}/messages`, agent, { text: 'Yes, from Trips › Top up.', status: 'resolved' });
    const theirs = await json<SupportChat>(call('GET', `/v1/support/chats/${id}`, traveller));
    expect(theirs.chat).toMatchObject({ status: 'resolved', rating_asked: true });
    expect(theirs.messages.at(-1)?.text).toBe('Yes, from Trips › Top up.');
    const older = await json<SupportChat>(call('GET', `/v1/support/chats/${chatId}`, traveller));
    expect(older.messages.map((item) => item.text)).not.toContain('Yes, from Trips › Top up.');

    expect((await call('POST', `/v1/support/chats/${id}/rating`, traveller, { score: 4 })).status).toBe(204);
    expect((await json<SupportChat>(call('GET', `/v1/support/chats/${id}`, traveller))).chat.rating_asked).toBe(false);

    const replied = await json<SupportChat>(call('POST', `/v1/support/chats/${id}/messages`, traveller, { text: 'One more thing' }));
    expect(replied.chat.status).toBe('open');
  });

  it('hides other people’s chats', async () => {
    const [newest] = await json<SupportChatSummary[]>(call('GET', '/v1/support/chats', traveller));
    expect((await call('GET', `/v1/support/chats/${newest?.id}`, other)).status).toBe(404);
    expect((await call('POST', `/v1/support/chats/${newest?.id}/messages`, other, { text: 'hi' })).status).toBe(404);
    expect((await call('GET', '/v1/support/chats/not-a-uuid', traveller)).status).toBe(404);
  });

  it('lets staff start a chat from a profile and change its plan', async () => {
    const started = await call('POST', `/v1/admin/customers/${travellerId}/conversations`, agent, { text: 'Your Japan plan ends tomorrow.', iccid: japan });
    expect(started.status).toBe(201);
    const chat = (await started.json()) as { id: string; number: number; status: string; esim: unknown; other_chats: unknown[] };
    expect(chat).toMatchObject({ number: 1003, status: 'pending', esim: { iccid: japan } });
    expect(chat.other_chats).toHaveLength(2);
    expect((await call('PATCH', `/v1/admin/conversations/${chat.id}`, agent, { iccid: strangers })).status).toBe(422);
    const cleared = await json<{ esim: unknown }>(call('PATCH', `/v1/admin/conversations/${chat.id}`, agent, { iccid: null }));
    expect(cleared.esim).toBeNull();
    const chats = await json<SupportChatSummary[]>(call('GET', '/v1/support/chats', traveller));
    expect(chats[0]).toMatchObject({ number: 1003, status: 'pending' });
  });
});
