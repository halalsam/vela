import { createDb } from './db/client';
import { loadEnv } from './env';
import { findUserIdByLogin } from './models/account.model';
import { setRole } from './models/profile.model';

const [who, role] = process.argv.slice(2);
if (!who || !role || !['customer', 'support', 'admin'].includes(role)) {
  console.error('Usage: node dist/grant-role.js <phone or email> <customer|support|admin>');
  process.exit(1);
}

const env = loadEnv();
const { db, pool } = createDb(env.DATABASE_URL);
const userId = await findUserIdByLogin(db, who);
if (!userId) {
  console.error(`No account for ${who}. Sign in once first.`);
  await pool.end();
  process.exit(1);
}
await setRole(db, userId, role as 'customer' | 'support' | 'admin');
console.log(`${who} is now ${role}`);
await pool.end();
