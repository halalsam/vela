import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { blogLocaleSchema, seoBundleSchema } from '@vela/api';
import { etag } from 'hono/etag';
import { seoBundle } from '../modules/seo/seo';
import type { AppEnv } from '../types';

const seoRoute = createRoute({
  method: 'get',
  path: '/v1/seo',
  tags: ['seo'],
  request: { query: z.object({ locale: blogLocaleSchema.default('en') }) },
  responses: {
    200: { description: 'Site SEO settings and page overrides for one language', content: { 'application/json': { schema: seoBundleSchema } } },
  },
});

export const seoRoutes = new OpenAPIHono<AppEnv>();

seoRoutes.use('/v1/seo', etag());
seoRoutes.use('/v1/seo', async (c, next) => {
  await next();
  if (c.res.status === 200) c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
});

seoRoutes.openapi(seoRoute, async (c) => c.json(await seoBundle(c.var.deps.db, c.req.valid('query').locale), 200));
