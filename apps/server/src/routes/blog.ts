import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { blogLocaleSchema, blogPostSchema, blogPostSummarySchema } from '@vela/api';
import { etag } from 'hono/etag';
import { listPublishedPosts, publishedPost } from '../modules/blog/blog';
import type { AppEnv } from '../types';

const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const localeQuery = z.object({ locale: blogLocaleSchema.default('en') });

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

const postsRoute = createRoute({
  method: 'get',
  path: '/v1/blog/posts',
  tags: ['blog'],
  request: { query: localeQuery },
  responses: { 200: json(z.array(blogPostSummarySchema), 'Published posts in one language, newest first') },
});

const postRoute = createRoute({
  method: 'get',
  path: '/v1/blog/posts/{slug}',
  tags: ['blog'],
  request: { params: z.object({ slug: z.string().min(1).max(120) }), query: localeQuery },
  responses: {
    200: json(blogPostSchema, 'One published post'),
    404: json(errorSchema, 'No published post with that slug'),
  },
});

export const blogRoutes = new OpenAPIHono<AppEnv>();

blogRoutes.use('/v1/blog/*', etag());
blogRoutes.use('/v1/blog/*', async (c, next) => {
  await next();
  if (c.res.status === 200) c.header('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
});

blogRoutes
  .openapi(postsRoute, async (c) => c.json(await listPublishedPosts(c.var.deps.db, c.req.valid('query').locale), 200))
  .openapi(postRoute, async (c) => c.json(await publishedPost(c.var.deps.db, c.req.valid('query').locale, c.req.valid('param').slug), 200));
