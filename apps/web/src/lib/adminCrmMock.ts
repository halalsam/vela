'use client';

import type {
  Activity,
  AdminBroadcast,
  AdminConversation,
  AdminConversationRow,
  AdminCustomer,
  AdminCustomerRow,
  AdminOrder,
  AdminOrderRow,
  ConversationStatus,
  CustomerFilter,
  SavedReply,
  Spend,
} from './adminApi';

const MINUTE = 60_000;
const ME = { user_id: 'staff_demo', name: 'You' };
const STAFF = [
  { user_id: 'staff_demo', name: 'You', role: 'admin' as const },
  { user_id: 'staff_aisha', name: 'Aisha (support)', role: 'support' as const },
];

type Message = AdminConversation['messages'][number];
type Thread = { status: ConversationStatus; assignee: { user_id: string; name: string } | null; readAt: number; ratingRequested: boolean; resolvedAt: string | null; messages: Message[] };

type Fail = (status: number, message: string) => never;

type Store = {
  customers: Map<string, Omit<AdminCustomer, 'orders' | 'esims' | 'orders_count' | 'spend' | 'last_order_at' | 'conversation'>>;
  threads: Map<string, Thread>;
  replies: SavedReply[];
  broadcasts: AdminBroadcast[];
};

let store: Store | null = null;

function at(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * MINUTE).toISOString();
}

function seed(orders: AdminOrder[]): Store {
  const customers: Store['customers'] = new Map();
  for (const order of orders) {
    if (customers.has(order.customer.user_id)) continue;
    const index = customers.size;
    customers.set(order.customer.user_id, {
      user_id: order.customer.user_id,
      name: order.customer.name,
      phone: order.customer.phone,
      email: order.customer.email,
      language: order.customer.phone?.startsWith('+96') || order.customer.phone?.startsWith('+97') ? (index % 2 === 0 ? 'ar' : 'en') : 'en',
      currency: order.currency,
      role: 'customer',
      joined_at: at(60 * 24 * (40 + index * 9)),
      referral_code: `VELA${String(1000 + index * 37)}`,
      referred_by: null,
      referrals: index % 3,
      tags: index === 0 ? ['vip'] : index === 2 ? ['business', 'had issue'] : index === 4 ? ['had issue'] : [],
      credit: index === 1 ? [{ currency: 'INR', amount: 150 }] : [],
      devices: [{ platform: index % 2 === 0 ? 'ios' : 'android', locale: 'en', last_seen_at: at(30 + index * 200) }],
      ratings: index === 3 ? [{ score: 5, comment: 'Quick and clear, thank you', at: at(60 * 30) }] : [],
      history: [],
    });
  }
  const ids = [...customers.keys()];
  const say = (from: 'agent' | 'user', text: string, minutesAgo: number, extra: Partial<Message> = {}): Message => ({
    id: crypto.randomUUID(),
    from,
    text,
    internal: false,
    staff: from === 'agent' ? STAFF[1]! : null,
    at: at(minutesAgo),
    ...extra,
  });
  const threads: Store['threads'] = new Map();
  const add = (index: number, thread: Omit<Thread, 'readAt' | 'ratingRequested' | 'resolvedAt'> & Partial<Thread>) => {
    const id = ids[index];
    if (id) threads.set(id, { readAt: 0, ratingRequested: false, resolvedAt: null, ...thread });
  };
  add(1, {
    status: 'open',
    assignee: null,
    messages: [say('user', 'Hi, I landed in Tokyo and the eSIM shows no service.', 14), say('user', 'I already restarted the phone twice.', 9)],
  });
  add(4, {
    status: 'open',
    assignee: STAFF[1]!,
    messages: [
      say('user', 'Can I use my Europe plan in Switzerland?', 60 * 5),
      say('agent', 'Yes, Switzerland is included in the Europe plan.', 60 * 5 - 6),
      say('agent', 'Customer asked same thing last trip. Maybe add to FAQ.', 60 * 5 - 5, { internal: true }),
      say('user', 'Great. And how do I top up if I run out?', 38),
    ],
    readAt: Date.now() - 60 * MINUTE,
  });
  add(0, {
    status: 'pending',
    assignee: ME,
    messages: [
      say('user', 'Will my WhatsApp number still work with the eSIM?', 60 * 26),
      say('agent', 'Yes. Your WhatsApp stays on your usual number. The eSIM only carries data.', 60 * 25, { staff: ME }),
    ],
    readAt: Date.now(),
  });
  add(3, {
    status: 'resolved',
    assignee: STAFF[1]!,
    resolvedAt: at(60 * 31),
    messages: [
      say('user', 'The QR code email never arrived.', 60 * 32),
      say('agent', 'Sent again just now. You can also install it from the app under Trips.', 60 * 31 + 10),
      say('user', 'Got it, installed. Thanks!', 60 * 31),
    ],
    readAt: Date.now(),
  });
  add(6, {
    status: 'open',
    assignee: null,
    messages: [say('user', 'أريد استرداد المبلغ، لم أستخدم الشريحة', 3)],
  });
  return {
    customers,
    threads,
    replies: [
      { id: crypto.randomUUID(), title: 'Turn on data roaming', body: 'Please open Settings › Mobile Data › your vela line and turn on Data Roaming. It needs to be on for the eSIM to connect abroad.', updated_at: at(60 * 24 * 3) },
      { id: crypto.randomUUID(), title: 'Restart and select network', body: 'Could you restart your phone, then go to Settings › Mobile Data › Network Selection and pick a network manually? That usually fixes "No service" on arrival.', updated_at: at(60 * 24 * 5) },
      { id: crypto.randomUUID(), title: 'Refund policy', body: 'We refund any eSIM that has not been installed yet. Once it is installed and has connected, we can help fix it but can’t refund it.', updated_at: at(60 * 24 * 9) },
    ],
    broadcasts: [
      {
        id: crypto.randomUUID(),
        title: 'Your plan ends tomorrow',
        body: 'Top up in a tap to stay connected for the rest of your trip.',
        title_ar: null,
        body_ar: null,
        segment: { activity: 'expiring_3d' },
        status: 'sent',
        audience: 3,
        reached: 3,
        created_by: 'You',
        created_at: at(60 * 24 * 2),
        sent_at: at(60 * 24 * 2 - 1),
        error: null,
      },
    ],
  };
}

function orderRow(order: AdminOrder): AdminOrderRow {
  return {
    order_id: order.order_id,
    number: order.number,
    kind: order.kind,
    status: order.status,
    plan_id: order.plan_id,
    iccid: order.esim?.iccid ?? null,
    total: order.total,
    currency: order.currency,
    created_at: order.created_at,
    customer: { user_id: order.customer.user_id, name: order.customer.name, phone: order.customer.phone, email: order.customer.email },
    invoice_number: order.invoice?.number ?? null,
  };
}

function ordersOf(orders: AdminOrder[], userId: string) {
  return orders.filter((order) => order.customer.user_id === userId);
}

function stats(orders: AdminOrder[]) {
  const done = orders.filter((order) => order.status === 'fulfilled' || order.status === 'refunded');
  const spend = new Map<string, number>();
  for (const order of done) if (order.status === 'fulfilled') spend.set(order.currency, (spend.get(order.currency) ?? 0) + order.total);
  return {
    orders: done.length,
    spend: [...spend].map(([currency, total]): Spend => ({ currency, total: Math.round(total * 100) / 100 })),
    last: done[0]?.created_at ?? null,
  };
}

function esimsOf(orders: AdminOrder[]) {
  return orders.flatMap((order) =>
    order.esim
      ? [{ ...order.esim, label: order.plan_id ?? 'eSIM', plan_id: order.plan_id ?? '', activated_at: order.fulfilled_at }]
      : [],
  );
}

function matches(customer: Store['customers'] extends Map<string, infer C> ? C : never, orders: AdminOrder[], filter: CustomerFilter): boolean {
  const mine = ordersOf(orders, customer.user_id);
  const done = mine.filter((order) => order.status === 'fulfilled' || order.status === 'refunded');
  if (filter.q) {
    const q = filter.q.toLowerCase();
    const fields = [customer.name, customer.phone, customer.email, ...mine.map((order) => order.number), ...mine.map((order) => order.esim?.iccid)];
    if (!fields.some((value) => value?.toLowerCase().includes(q))) return false;
  }
  if (filter.tag && !customer.tags.includes(filter.tag)) return false;
  if (filter.language && (customer.language.startsWith('ar') ? 'ar' : 'en') !== filter.language) return false;
  if (filter.country && !done.some((order) => order.plan_id?.startsWith(filter.country!.toLowerCase()))) return false;
  const activity: Activity | undefined = filter.activity;
  const now = Date.now();
  if (activity === 'active_esim' && !done.some((order) => order.esim && ['active', 'not_started'].includes(order.esim.status))) return false;
  if (activity === 'expiring_3d' && !done.some((order) => order.esim?.status === 'active' && order.esim.expires_at && Date.parse(order.esim.expires_at) - now < 3 * 86_400_000 && Date.parse(order.esim.expires_at) > now)) return false;
  if (activity === 'bought_30d' && !done.some((order) => now - Date.parse(order.created_at) < 30 * 86_400_000)) return false;
  if (activity === 'never_bought' && done.length > 0) return false;
  if (activity === 'lapsed_90d' && (done.length === 0 || done.some((order) => now - Date.parse(order.created_at) < 90 * 86_400_000))) return false;
  return true;
}

function filterFrom(params: URLSearchParams | Record<string, unknown>): CustomerFilter {
  const get = (key: string) => {
    const value = params instanceof URLSearchParams ? params.get(key) : params[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  };
  return { q: get('q'), tag: get('tag'), language: get('language') as 'en' | 'ar' | undefined, activity: get('activity') as Activity | undefined, country: get('country') };
}

function conversation(state: Store, orders: AdminOrder[], userId: string, fail: Fail): AdminConversation {
  const customer = state.customers.get(userId);
  if (!customer) fail(404, 'Customer not found');
  const thread = state.threads.get(userId);
  const mine = ordersOf(orders, userId);
  return {
    user_id: userId,
    status: thread?.status ?? null,
    assignee: thread?.assignee ?? null,
    resolved_at: thread?.resolvedAt ?? null,
    rating_requested: thread?.ratingRequested ?? false,
    last_rating: customer.ratings[0] ?? null,
    customer: { name: customer.name, phone: customer.phone, email: customer.email, language: customer.language, joined_at: customer.joined_at, tags: customer.tags },
    messages: thread?.messages ?? [],
    orders: mine.slice(0, 5).map(orderRow),
    esims: esimsOf(mine).slice(0, 5),
  };
}

function rows(state: Store, url: URL): AdminConversationRow[] {
  const status = url.searchParams.get('status') ?? 'open';
  const assignee = url.searchParams.get('assignee') ?? 'any';
  const q = url.searchParams.get('q')?.toLowerCase();
  const tag = url.searchParams.get('tag');
  const list: AdminConversationRow[] = [];
  for (const [userId, thread] of state.threads) {
    const customer = state.customers.get(userId);
    if (!customer) continue;
    if (status !== 'all' && thread.status !== status) continue;
    if (assignee === 'me' && thread.assignee?.user_id !== ME.user_id) continue;
    if (assignee === 'unassigned' && thread.assignee) continue;
    if (tag && !customer.tags.includes(tag)) continue;
    if (q && ![customer.name, customer.phone, customer.email, ...thread.messages.map((item) => item.text)].some((value) => value?.toLowerCase().includes(q))) continue;
    const last = thread.messages.at(-1);
    const lastCustomer = [...thread.messages].reverse().find((item) => item.from === 'user');
    list.push({
      user_id: userId,
      customer: { name: customer.name, phone: customer.phone, email: customer.email, language: customer.language },
      status: thread.status,
      assignee: thread.assignee,
      last_message: last ? { text: last.text, from: last.from, internal: last.internal, at: last.at } : null,
      unread: thread.messages.filter((item) => item.from === 'user' && Date.parse(item.at) > thread.readAt).length,
      waiting_since: thread.status === 'open' ? (lastCustomer?.at ?? null) : null,
      last_message_at: last?.at ?? new Date().toISOString(),
    });
  }
  return list.sort((a, b) => {
    if ((a.status === 'open') !== (b.status === 'open')) return a.status === 'open' ? -1 : 1;
    if (a.status === 'open') return (a.waiting_since ?? '').localeCompare(b.waiting_since ?? '');
    return b.last_message_at.localeCompare(a.last_message_at);
  });
}

/** Demo answers for the CRM endpoints. Returns `undefined` for paths it doesn't handle. */
export function demoCrm(orders: AdminOrder[], url: URL, method: string, body: Record<string, unknown>, fail: Fail): unknown {
  store ??= seed(orders);
  const state = store;
  const parts = url.pathname.split('/').filter(Boolean);
  const path = url.pathname;

  if (path === '/v1/admin/staff') return STAFF;
  if (path === '/v1/admin/conversations/stats') {
    const all = [...state.threads.values()];
    const ratings = [...state.customers.values()].flatMap((item) => item.ratings);
    return {
      open: all.filter((item) => item.status === 'open').length,
      pending: all.filter((item) => item.status === 'pending').length,
      unassigned: all.filter((item) => item.status === 'open' && !item.assignee).length,
      resolved_24h: all.filter((item) => item.status === 'resolved' && item.resolvedAt && Date.now() - Date.parse(item.resolvedAt) < 86_400_000).length,
      median_first_reply_minutes: 7,
      rating_30d: ratings.length ? { average: ratings.reduce((sum, item) => sum + item.score, 0) / ratings.length, count: ratings.length } : null,
    };
  }
  if (path === '/v1/admin/conversations' && method === 'GET') return rows(state, url);
  if (parts[2] === 'conversations' && parts[3]) {
    const userId = decodeURIComponent(parts[3]);
    if (parts[4] === 'messages' && method === 'POST') {
      if (!state.customers.has(userId)) fail(404, 'Customer not found');
      const text = String(body.text ?? '').trim();
      if (!text) fail(400, 'Write a message first');
      const internal = Boolean(body.internal);
      const thread = state.threads.get(userId) ?? { status: 'open' as ConversationStatus, assignee: null, readAt: Date.now(), ratingRequested: false, resolvedAt: null, messages: [] };
      thread.messages.push({ id: crypto.randomUUID(), from: 'agent', text, internal, staff: ME, at: new Date().toISOString() });
      if (!internal) {
        thread.status = (body.status as ConversationStatus | undefined) ?? 'pending';
        thread.assignee ??= ME;
        thread.readAt = Date.now();
        thread.ratingRequested = thread.status === 'resolved';
        thread.resolvedAt = thread.status === 'resolved' ? new Date().toISOString() : null;
      }
      state.threads.set(userId, thread);
      return conversation(state, orders, userId, fail);
    }
    if (method === 'PATCH') {
      const thread = state.threads.get(userId);
      if (!thread) fail(404, 'Conversation not found');
      if (typeof body.status === 'string' && body.status !== thread.status) {
        thread.status = body.status as ConversationStatus;
        thread.resolvedAt = thread.status === 'resolved' ? new Date().toISOString() : null;
        thread.ratingRequested = thread.status === 'resolved' && thread.messages.some((item) => item.from === 'agent' && !item.internal);
      }
      if ('assignee_id' in body) thread.assignee = STAFF.find((item) => item.user_id === body.assignee_id) ?? null;
      return conversation(state, orders, userId, fail);
    }
    if (method === 'GET') {
      const thread = state.threads.get(userId);
      if (thread && url.searchParams.get('read') !== '0') thread.readAt = Date.now();
      return conversation(state, orders, userId, fail);
    }
  }
  if (path === '/v1/admin/saved-replies' && method === 'GET') return [...state.replies].sort((a, b) => a.title.localeCompare(b.title));
  if (path === '/v1/admin/saved-replies' && method === 'POST') {
    const created = { id: crypto.randomUUID(), title: String(body.title ?? ''), body: String(body.body ?? ''), updated_at: new Date().toISOString() };
    state.replies.push(created);
    return created;
  }
  if (parts[2] === 'saved-replies' && parts[3]) {
    const reply = state.replies.find((item) => item.id === parts[3]);
    if (!reply) fail(404, 'Saved reply not found');
    if (method === 'DELETE') {
      state.replies.splice(state.replies.indexOf(reply), 1);
      return undefined;
    }
    if (typeof body.title === 'string') reply.title = body.title;
    if (typeof body.body === 'string') reply.body = body.body;
    reply.updated_at = new Date().toISOString();
    return reply;
  }
  if (path === '/v1/admin/tags') {
    const counts = new Map<string, number>();
    for (const customer of state.customers.values()) for (const tag of customer.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([tag, customers]) => ({ tag, customers }));
  }
  if (path === '/v1/admin/customers' && method === 'GET') {
    const filter = filterFrom(url.searchParams);
    const list = [...state.customers.values()].filter((customer) => matches(customer, orders, filter));
    return {
      total: list.length,
      customers: list.map((customer): AdminCustomerRow => {
        const summary = stats(ordersOf(orders, customer.user_id));
        return {
          user_id: customer.user_id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          language: customer.language,
          joined_at: customer.joined_at,
          orders: summary.orders,
          spend: summary.spend,
          last_order_at: summary.last,
          tags: customer.tags,
          conversation: state.threads.get(customer.user_id)?.status ?? null,
        };
      }),
    };
  }
  if (parts[2] === 'customers' && parts[3]) {
    const customer = state.customers.get(decodeURIComponent(parts[3]));
    if (!customer) fail(404, 'Customer not found');
    if (parts[4] === 'tags' && method === 'PUT') {
      const tags = [...new Set(((body.tags as string[] | undefined) ?? []).map((tag) => tag.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean))].sort();
      if (tags.some((tag) => !/^[a-z0-9][a-z0-9 -]{0,29}$/.test(tag))) fail(422, 'Tags are 1 to 30 letters, numbers, spaces or hyphens');
      customer.history.unshift({ action: 'customer.tags', actor_id: ME.user_id, data: { tags }, at: new Date().toISOString() });
      customer.tags = tags;
      return { tags };
    }
    const mine = ordersOf(orders, customer.user_id);
    const summary = stats(mine);
    const thread = state.threads.get(customer.user_id);
    return {
      ...customer,
      orders_count: summary.orders,
      spend: summary.spend,
      last_order_at: summary.last,
      orders: mine.map(orderRow),
      esims: esimsOf(mine),
      conversation: thread ? { status: thread.status, assignee_id: thread.assignee?.user_id ?? null, last_message_at: thread.messages.at(-1)?.at ?? customer.joined_at } : null,
    } satisfies AdminCustomer;
  }
  if (parts[2] === 'users' && parts[3] && parts[4] === 'credit' && method === 'POST') {
    const customer = state.customers.get(decodeURIComponent(parts[3]));
    if (!customer) fail(404, 'Customer not found');
    const currency = String(body.currency ?? 'INR');
    const amount = Number(body.amount ?? 0);
    const existing = customer.credit.find((item) => item.currency === currency);
    if (existing) existing.amount += amount;
    else customer.credit.push({ currency, amount });
    customer.history.unshift({ action: 'credit.grant', actor_id: ME.user_id, data: body, at: new Date().toISOString() });
    return undefined;
  }
  if (path === '/v1/admin/broadcasts' && method === 'GET') return state.broadcasts;
  if (path === '/v1/admin/broadcasts/audience') {
    const filter = filterFrom((body.segment as Record<string, unknown> | undefined) ?? {});
    const count = [...state.customers.values()].filter((customer) => matches(customer, orders, filter)).length;
    return { customers: count, reachable: count };
  }
  if (path === '/v1/admin/broadcasts' && method === 'POST') {
    const segment = filterFrom((body.segment as Record<string, unknown> | undefined) ?? {});
    const audience = [...state.customers.values()].filter((customer) => matches(customer, orders, segment)).length;
    const created: AdminBroadcast = {
      id: crypto.randomUUID(),
      title: String(body.title ?? ''),
      body: String(body.body ?? ''),
      title_ar: (body.title_ar as string | null) || null,
      body_ar: (body.body_ar as string | null) || null,
      segment,
      status: 'sent',
      audience,
      reached: audience,
      created_by: 'You',
      created_at: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      error: null,
    };
    state.broadcasts.unshift(created);
    return created;
  }
  return undefined;
}
