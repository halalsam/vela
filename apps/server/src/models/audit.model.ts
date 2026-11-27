import { desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { auditLog } from '../db/schema';

export type AuditRow = typeof auditLog.$inferSelect;

/** Records a staff action. `target` is "kind:id", e.g. "order:<uuid>". */
export async function audit(db: Database, actorId: string, action: string, target: string, data: Record<string, unknown> = {}): Promise<void> {
  await db.insert(auditLog).values({ actorId, action, target, data });
}

export async function auditFor(db: Database, target: string | undefined, limit?: number): Promise<AuditRow[]> {
  const query = db
    .select()
    .from(auditLog)
    .where(target ? eq(auditLog.target, target) : undefined)
    .orderBy(desc(auditLog.createdAt));
  return limit ? query.limit(limit) : query;
}
