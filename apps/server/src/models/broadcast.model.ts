import { desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { broadcast, profile } from '../db/schema';

export type BroadcastRow = typeof broadcast.$inferSelect;

export async function recentBroadcasts(db: Database, limit: number) {
  return db
    .select({ broadcast, name: profile.name })
    .from(broadcast)
    .leftJoin(profile, eq(profile.userId, broadcast.createdBy))
    .orderBy(desc(broadcast.createdAt))
    .limit(limit);
}

export async function findBroadcast(db: Database, id: string): Promise<BroadcastRow | null> {
  const [row] = await db.select().from(broadcast).where(eq(broadcast.id, id));
  return row ?? null;
}

export async function insertBroadcast(db: Database, values: typeof broadcast.$inferInsert): Promise<BroadcastRow> {
  const [row] = await db.insert(broadcast).values(values).returning();
  if (!row) throw new Error('Broadcast was not stored');
  return row;
}

export async function updateBroadcast(db: Database, id: string, values: Partial<typeof broadcast.$inferInsert>): Promise<void> {
  await db.update(broadcast).set(values).where(eq(broadcast.id, id));
}
