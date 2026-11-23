import { createMiddleware } from 'hono/factory';
import { HttpError } from '../lib/errors';
import type { AppEnv } from '../types';

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const result = await c.var.deps.auth.api.getSession({ headers: c.req.raw.headers });
  if (!result) throw new HttpError(401, 'unauthenticated', 'Sign in to continue');
  const phone = (result.user as { phoneNumber?: unknown }).phoneNumber;
  c.set('user', {
    id: result.user.id,
    email: result.user.email,
    name: result.user.name,
    phoneNumber: typeof phone === 'string' ? phone : null,
  });
  await next();
});
