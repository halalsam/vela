import type * as routes from '../routes/devices.routes';
import * as devices from '../services/devices.service';
import * as usage from '../services/usage.service';
import type { Handler } from '../types';

export const register: Handler<typeof routes.registerDevice> = async (c) => {
  const input = c.req.valid('json');
  await devices.registerDevice(c.var.deps.db, c.var.user.id, { platform: input.platform, pushToken: input.push_token, locale: input.locale });
  return c.body(null, 204);
};

export const remove: Handler<typeof routes.removeDevice> = async (c) => {
  await devices.removeDevice(c.var.deps.db, c.var.user.id, c.req.valid('json').push_token);
  return c.body(null, 204);
};

export const startLiveActivity: Handler<typeof routes.startActivity> = async (c) => {
  const input = c.req.valid('json');
  await devices.startLiveActivity(c.var.deps.db, c.var.user.id, c.req.valid('param').iccid, {
    pushToken: input.push_token,
    locale: input.locale,
    deviceToken: input.device_token,
  });
  return c.body(null, 204);
};

export const endLiveActivity: Handler<typeof routes.endActivity> = async (c) => {
  await devices.endLiveActivity(c.var.deps.db, c.var.user.id, c.req.valid('param').iccid);
  return c.body(null, 204);
};

export const dailyUsage: Handler<typeof routes.dailyRoute> = async (c) =>
  c.json(await usage.dailyUsage(c.var.deps.db, c.var.user.id, c.req.valid('param').iccid), 200);
