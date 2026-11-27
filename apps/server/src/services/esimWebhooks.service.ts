import { createHash } from 'node:crypto';
import type { Database } from '../db/client';
import { JOB, type JobQueue } from '../jobs/queue';
import { HttpError } from '../lib/errors';
import * as esims from '../models/esim.model';
import * as payments from '../models/payment.model';

const USAGE_EVENTS = new Set(['ESIM_STATUS', 'DATA_USAGE', 'VALIDITY_USAGE', 'SMDP_EVENT']);

type Notification = {
  notifyType?: string;
  notifyId?: string;
  content?: { esimTranNo?: string; iccid?: string };
};

export type EsimWebhookResult = { type: string; eventId: string | null; duplicate: boolean; queued: boolean };

/** Records an eSIM Access notification once and queues a usage sync for the eSIM it is about. */
export async function handleEsimAccessWebhook(deps: { db: Database; queue: JobQueue }, raw: string): Promise<EsimWebhookResult> {
  let body: Notification;
  try {
    body = JSON.parse(raw) as Notification;
  } catch {
    throw new HttpError(400, 'bad_request', 'Webhook body is not JSON');
  }
  const type = body.notifyType ?? 'UNKNOWN';
  if (type === 'CHECK_HEALTH') return { type, eventId: null, duplicate: false, queued: false };

  const eventId = body.notifyId || createHash('sha256').update(raw).digest('hex').slice(0, 32);
  const stored = await payments.recordWebhookEvent(deps.db, { source: 'esim', eventId, type, payload: body as object });
  if (stored?.processedAt) return { type, eventId, duplicate: true, queued: false };

  let queued = false;
  const tranNo = body.content?.esimTranNo;
  const iccid = body.content?.iccid;
  if (USAGE_EVENTS.has(type) && (tranNo || iccid)) {
    const esimId = await esims.findEsimIdByRef(deps.db, { providerRef: tranNo, iccid });
    if (esimId) {
      await deps.queue.send(JOB.usageOne, { esimId }, { singletonKey: esimId });
      queued = true;
    }
  }
  await payments.finishWebhookEvent(deps.db, 'esim', eventId, null);
  return { type, eventId, duplicate: false, queued };
}
