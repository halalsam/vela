import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { blogLocaleSchema, blogPostSchema, blogPostSummarySchema, seoBundleSchema } from '@vela/api';
import { etag } from 'hono/etag';
import * as content from '../controllers/content.controller';
import type { AppEnv } from '../types';
import { publicCache } from './cache';
import { failure, json } from './openapi';

const localeQuery = z.object({ locale: blogLocaleSchema.default('en') });

export const postsRoute = createRoute({
  method: 'get',
  path: '/v1/blog/posts',
  tags: ['blog'],
  request: { query: localeQuery },
  responses: { 200: json(z.array(blogPostSummarySchema), 'Published posts in one language, newest first') },
});

export const postRoute = createRoute({
  method: 'get',
  path: '/v1/blog/posts/{slug}',
  tags: ['blog'],
  request: { params: z.object({ slug: z.string().min(1).max(120) }), query: localeQuery },
  responses: {
    200: json(blogPostSchema, 'One published post'),
    404: failure('No published post with that slug'),
  },
});

export const seoRoute = createRoute({
  method: 'get',
  path: '/v1/seo',
  tags: ['seo'],
  request: { query: z.object({ locale: blogLocaleSchema.default('en') }) },
  responses: {
    200: { description: 'Site SEO settings and page overrides for one language', content: { 'application/json': { schema: seoBundleSchema } } },
  },
});

export const contentRoutes = new OpenAPIHono<AppEnv>();

contentRoutes.use('/v1/blog/*', etag(), publicCache(120, 600));
contentRoutes.use('/v1/seo', etag(), publicCache(60, 300));

contentRoutes
  .openapi(postsRoute, content.listPosts)
  .openapi(postRoute, content.getPost)
  .openapi(seoRoute, content.seoBundle)
  .get('/v1/uploads/*', content.serveUpload);
