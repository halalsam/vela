import { sql } from 'drizzle-orm';
import type { Database } from '../db/client';

export async function ping(db: Database): Promise<void> {
  await db.execute(sql`select 1`);
}
