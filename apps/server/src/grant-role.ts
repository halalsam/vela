import { eq, or } from 'drizzle-orm';
import { createDb } from './db/client';
import { profile, user } from './db/schema';
import { loadEnv } from './env';

const [who, role] = process.argv.slice(2);
if (!who || !role || !['customer', 'support', 'admin'].includes(role)) {
  console.error('Usage: node dist/grant-role.js <phone or email> <customer|support|admin>');
  process.exit(1);
}

const env = loadEnv();
const { db, pool } = createDb(env.DATABASE_URL);
const [found] = await db
  .select({ id: user.id })
  .from(user)
  .where(or(eq(user.phoneNumber, who), eq(user.email, who.toLowerCase())));
if (!found) {
  console.error(`No account for ${who}. Sign in once first.`);
  await pool.end();
  process.exit(1);
}
await db
  .update(profile)
  .set({ role: role as 'customer' | 'support' | 'admin', updatedAt: new Date() })
  .where(eq(profile.userId, found.id));
console.log(`${who} is now ${role}`);
await pool.end();
