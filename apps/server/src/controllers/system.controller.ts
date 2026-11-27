import type * as routes from '../routes/system.routes';
import { databaseIsUp } from '../services/system.service';
import type { Handler } from '../types';

export const health: Handler<typeof routes.health> = (c) => c.json({ status: 'ok' as const }, 200);

export const ready: Handler<typeof routes.ready> = async (c) => {
  if (await databaseIsUp(c.var.deps.db, c.var.logger)) return c.json({ status: 'ready' as const, checks: { database: 'ok' as const } }, 200);
  return c.json({ status: 'degraded' as const, checks: { database: 'down' as const } }, 503);
};

export const version: Handler<typeof routes.version> = (c) =>
  c.json({ version: c.var.deps.version, sha: c.var.deps.env.GIT_SHA, env: c.var.deps.env.APP_ENV }, 200);
