import type { Profile } from '@vela/api';
import { PHONE_EMAIL_DOMAIN } from '../auth/auth';
import type { Database } from '../db/client';
import type { Logger } from '../logger';
import * as accounts from '../models/account.model';
import * as profiles from '../models/profile.model';
import type { SessionUser } from '../types';
import { profileView } from '../views/account.view';

/** The signed-in traveller, preferring what they saved on their profile over the sign-in details. */
export async function profileFor(db: Database, current: SessionUser): Promise<Profile> {
  const [row, providers] = await Promise.all([profiles.findProfile(db, current.id), accounts.providerIds(db, current.id)]);
  const provider = providers.includes('apple') ? 'apple' : providers.includes('google') ? 'google' : 'phone';
  // Phone sign-ups get a placeholder email address that must never be shown.
  const email = current.email.endsWith(`@${PHONE_EMAIL_DOMAIN}`) ? null : current.email;
  return profileView(row, current, email, provider);
}

/** Deletes the account. Orders and invoices are kept for tax records without personal data. */
export async function deleteAccount(db: Database, logger: Logger, userId: string): Promise<void> {
  await accounts.deleteUser(db, userId);
  logger.info({ userId }, 'account deleted');
}
