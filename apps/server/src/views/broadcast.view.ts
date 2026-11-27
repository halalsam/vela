import type { BroadcastRow } from '../models/broadcast.model';
import type { CustomerFilter } from '../models/customer.model';

export function broadcastView(row: BroadcastRow, names: Map<string, string>) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    title_ar: row.titleAr,
    body_ar: row.bodyAr,
    segment: row.segment as CustomerFilter,
    status: row.status,
    audience: row.audience,
    reached: row.reached,
    created_by: names.get(row.createdBy) ?? 'Staff',
    created_at: row.createdAt.toISOString(),
    sent_at: row.sentAt?.toISOString() ?? null,
    error: row.error,
  };
}
