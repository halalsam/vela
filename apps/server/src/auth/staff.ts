import { createMiddleware } from 'hono/factory';
import { HttpError } from '../lib/errors';
import { roleOf, type StaffRole } from '../services/admin.service';
import type { AppEnv } from '../types';

export type AdminEnv = AppEnv & { Variables: AppEnv['Variables'] & { role: StaffRole } };

/** Lets support staff and admins through and records their role. Runs after `requireUser`. */
export const staffOnly = createMiddleware<AdminEnv>(async (c, next) => {
  const role = await roleOf(c.var.deps.db, c.var.user.id);
  if (role === 'customer') throw new HttpError(403, 'forbidden', 'Staff only');
  c.set('role', role);
  await next();
});

export const adminOnly = createMiddleware<AdminEnv>(async (c, next) => {
  if (c.var.role !== 'admin') throw new HttpError(403, 'forbidden', 'Admins only');
  await next();
});
