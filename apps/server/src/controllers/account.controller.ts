import type * as routes from '../routes/account.routes';
import { deleteAccount, profileFor } from '../services/account.service';
import type { Handler } from '../types';

export const getMe: Handler<typeof routes.getMe> = async (c) => c.json(await profileFor(c.var.deps.db, c.var.user), 200);

export const deleteMe: Handler<typeof routes.deleteMe> = async (c) => {
  await deleteAccount(c.var.deps.db, c.var.logger, c.var.user.id);
  return c.body(null, 204);
};
