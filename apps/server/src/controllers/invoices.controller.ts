import type { Context } from 'hono';
import type * as routes from '../routes/support.routes';
import { documentPdf, invoiceLinkForCustomer, type DocumentKind } from '../services/invoices.service';
import type { AppEnv, Handler } from '../types';

export const invoiceLink: Handler<typeof routes.invoiceRoute> = async (c) => {
  const { db, env } = c.var.deps;
  const link = await invoiceLinkForCustomer(db, env, c.var.logger, c.var.user.id, c.req.valid('param').id);
  return c.json({ number: link.number, url: link.url, expires_at: link.expiresAt.toISOString() }, 200);
};

/** Serves the PDF behind a signed link from the app, the receipt email or the admin. */
export async function downloadDocument(c: Context<AppEnv>) {
  const kind = c.req.param('kind') as DocumentKind;
  const id = (c.req.param('file') ?? '').replace(/\.pdf$/, '');
  const document = await documentPdf(c.var.deps.db, c.var.deps.env, kind, id, {
    expires: c.req.query('expires') ?? '',
    signature: c.req.query('signature') ?? '',
  });
  return c.body(new Uint8Array(document.pdf), 200, {
    'content-type': 'application/pdf',
    'content-disposition': `inline; filename="${document.filename}"`,
    'cache-control': 'private, no-store',
  });
}
