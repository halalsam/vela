import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { countrySchema, offerSchema, planSchema, regionSchema } from '@vela/api';
import { etag } from 'hono/etag';
import { notFound } from '../lib/errors';
import { listCountries, listOffers, listRegions, planById, plansForCountry, plansForRegion } from '../modules/catalog/queries';
import type { AppEnv } from '../types';

const currencyQuery = z.object({ currency: z.enum(['INR', 'AED', 'SAR']).default('INR') });
const errorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { 'application/json': { schema } },
});

const countriesRoute = createRoute({
  method: 'get',
  path: '/v1/catalog/countries',
  tags: ['catalog'],
  request: { query: currencyQuery },
  responses: { 200: json(z.array(countrySchema), 'Countries with at least one plan, cheapest price first available') },
});

const regionsRoute = createRoute({
  method: 'get',
  path: '/v1/catalog/regions',
  tags: ['catalog'],
  request: { query: currencyQuery },
  responses: { 200: json(z.array(regionSchema), 'Regional and global coverage with plans') },
});

const countryPlansRoute = createRoute({
  method: 'get',
  path: '/v1/catalog/plans',
  tags: ['catalog'],
  request: { query: currencyQuery.extend({ country: z.string().regex(/^[A-Za-z]{2}$/) }) },
  responses: { 200: json(z.array(planSchema), 'Plans for one country, cheapest first') },
});

const regionPlansRoute = createRoute({
  method: 'get',
  path: '/v1/catalog/regions/{id}/plans',
  tags: ['catalog'],
  request: { params: z.object({ id: z.string().min(1) }), query: currencyQuery },
  responses: { 200: json(z.array(planSchema), 'Plans for one region, cheapest first') },
});

const planRoute = createRoute({
  method: 'get',
  path: '/v1/catalog/plans/{id}',
  tags: ['catalog'],
  request: { params: z.object({ id: z.string().min(1) }), query: currencyQuery },
  responses: {
    200: json(planSchema, 'One active plan'),
    404: json(errorSchema, 'No active plan with that id'),
  },
});

const offersRoute = createRoute({
  method: 'get',
  path: '/v1/offers',
  tags: ['catalog'],
  responses: { 200: json(z.array(offerSchema), 'Live offers in display order') },
});

export const catalogRoutes = new OpenAPIHono<AppEnv>();

catalogRoutes.use('/v1/catalog/*', etag());
catalogRoutes.use('/v1/offers', etag());
catalogRoutes.use('/v1/catalog/*', async (c, next) => {
  await next();
  if (c.res.status === 200) c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
});
catalogRoutes.use('/v1/offers', async (c, next) => {
  await next();
  if (c.res.status === 200) c.header('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
});

catalogRoutes
  .openapi(countriesRoute, async (c) => c.json(await listCountries(c.var.deps.db, c.req.valid('query').currency), 200))
  .openapi(regionsRoute, async (c) => c.json(await listRegions(c.var.deps.db, c.req.valid('query').currency), 200))
  .openapi(countryPlansRoute, async (c) => {
    const { country, currency } = c.req.valid('query');
    return c.json(await plansForCountry(c.var.deps.db, country, currency), 200);
  })
  .openapi(regionPlansRoute, async (c) =>
    c.json(await plansForRegion(c.var.deps.db, c.req.valid('param').id, c.req.valid('query').currency), 200),
  )
  .openapi(planRoute, async (c) => {
    const result = await planById(c.var.deps.db, c.req.valid('param').id, c.req.valid('query').currency);
    if (!result) throw notFound('Plan');
    return c.json(result, 200);
  })
  .openapi(offersRoute, async (c) => c.json(await listOffers(c.var.deps.db), 200));
