import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import * as system from '../controllers/system.controller';
import type { AppEnv } from '../types';

export const health = createRoute({
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

export const ready = createRoute({
  method: 'get',
  path: '/ready',
  tags: ['system'],
  summary: 'Readiness probe, checks the database',
  responses: {
    200: { description: 'Ready to serve traffic', content: { 'application/json': { schema: readySchema } } },
    503: { description: 'A dependency is down', content: { 'application/json': { schema: readySchema } } },
  },
});

export const version = createRoute({
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

export const systemRoutes = new OpenAPIHono<AppEnv>().openapi(health, system.health).openapi(ready, system.ready).openapi(version, system.version);
