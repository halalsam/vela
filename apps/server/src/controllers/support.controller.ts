import type { Context } from 'hono';
import type * as routes from '../routes/support.routes';
import { supportUser } from '../services/support.service';
import type { AppEnv, Handler } from '../types';

/** The signed-in customer as the support desk sees them. */
function customer(c: Context<AppEnv>) {
  const user = c.var.user;
  return supportUser(c.var.deps.db, user.id, { name: user.name, email: null, phone: user.phoneNumber });
}

const desk = (c: Context<AppEnv>) => c.var.deps.support;

export const thread: Handler<typeof routes.threadRoute> = async (c) => c.json(await desk(c).thread(await customer(c)), 200);

export const send: Handler<typeof routes.sendRoute> = async (c) => c.json(await desk(c).send(await customer(c), c.req.valid('json').text), 200);

export const ratingStatus: Handler<typeof routes.ratingStatusRoute> = async (c) => c.json({ asked: await desk(c).ratingAsked(await customer(c)) }, 200);

export const rate: Handler<typeof routes.rateRoute> = async (c) => {
  const body = c.req.valid('json');
  await desk(c).rate(await customer(c), body.score, body.comment || null);
  return c.body(null, 204);
};

export const listChats: Handler<typeof routes.chatsRoute> = async (c) => c.json(await desk(c).chats(await customer(c)), 200);

export const startChat: Handler<typeof routes.startChatRoute> = async (c) => {
  const body = c.req.valid('json');
  return c.json(await desk(c).start(await customer(c), body.text, body.iccid), 201);
};

export const getChat: Handler<typeof routes.chatRoute> = async (c) => c.json(await desk(c).chat(await customer(c), c.req.valid('param').id), 200);

export const replyToChat: Handler<typeof routes.chatMessageRoute> = async (c) =>
  c.json(await desk(c).reply(await customer(c), c.req.valid('param').id, c.req.valid('json').text), 200);

export const rateChat: Handler<typeof routes.chatRatingRoute> = async (c) => {
  const body = c.req.valid('json');
  await desk(c).rateChat(await customer(c), c.req.valid('param').id, body.score, body.comment || null);
  return c.body(null, 204);
};
