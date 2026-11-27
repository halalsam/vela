import { z } from '@hono/zod-openapi';
import { requireUser } from '../auth/middleware';

/** Shared pieces for the OpenAPI route definitions. */

export const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

export const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

export const failure = (description: string) => json(errorSchema, description);

/** Spread into a route that needs a signed-in user. */
export const signedIn = { security: [{ bearer: [] }], middleware: requireUser };

export const sellingCurrency = z.enum(['INR', 'AED', 'SAR', 'EUR', 'USD']).default('INR');

export const iccidParam = z.string().regex(/^\d{19,20}$/);
