import { eq, or } from 'drizzle-orm';
import type { Database } from '../db/client';
import { account, user } from '../db/schema';

/** Sign-in providers linked to the user (apple, google, phone...). */
export async function providerIds(db: Database, userId: string): Promise<string[]> {
  const rows = await db.select({ providerId: account.providerId }).from(account).where(eq(account.userId, userId));
  return rows.map((row) => row.providerId);
}

/** Deletes the auth user; profile, devices and sessions go with it by cascade. */
export async function deleteUser(db: Database, userId: string): Promise<void> {
  await db.delete(user).where(eq(user.id, userId));
}

/** The auth user with this phone number or (lower-cased) email. */
export async function findUserIdByLogin(db: Database, login: string): Promise<string | null> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(or(eq(user.phoneNumber, login), eq(user.email, login.toLowerCase())));
  return row?.id ?? null;
}
