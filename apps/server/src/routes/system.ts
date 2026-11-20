import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { sql } from 'drizzle-orm';
import type { AppEnv } from '../types';

const health = createRoute({
  method: 'get',
  path: '/health',
  tags: ['system'],
  summary: 'Liveness probe',
  responses: {
    200: {
      description: 'The process is up',
      content: { 'application/json': { schema: z.object({ status: z.literal('ok') }) } },
    },
  },
});

const readySchema = z.object({
  status: z.enum(['ready', 'degraded']),
  checks: z.object({ database: z.enum(['ok', 'down']) }),
});

const ready = createRoute({
  method: 'get',
  path: '/ready',
  tags: ['system'],
  summary: 'Readiness probe, checks the database',
  responses: {
    200: { description: 'Ready to serve traffic', content: { 'application/json': { schema: readySchema } } },
    503: { description: 'A dependency is down', content: { 'application/json': { schema: readySchema } } },
  },
});

const version = createRoute({
  method: 'get',
  path: '/v1/version',
  tags: ['system'],
  summary: 'Build and environment',
  responses: {
    200: {
      description: 'Version info',
      content: {
        'application/json': {
          schema: z.object({ version: z.string(), sha: z.string(), env: z.enum(['local', 'staging', 'production']) }),
        },
      },
    },
  },
});

export const systemRoutes = new OpenAPIHono<AppEnv>()
  .openapi(health, (c) => c.json({ status: 'ok' as const }, 200))
  .openapi(ready, async (c) => {
    try {
      await c.var.deps.db.execute(sql`select 1`);
      return c.json({ status: 'ready' as const, checks: { database: 'ok' as const } }, 200);
    } catch (error) {
      c.var.logger.error({ err: error }, 'readiness check failed');
      return c.json({ status: 'degraded' as const, checks: { database: 'down' as const } }, 503);
    }
  })
  .openapi(version, (c) =>
    c.json({ version: c.var.deps.version, sha: c.var.deps.env.GIT_SHA, env: c.var.deps.env.APP_ENV }, 200),
  );
