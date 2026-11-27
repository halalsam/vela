import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { countrySchema, offerSchema, planSchema, regionSchema } from '@vela/api';
import { etag } from 'hono/etag';
import * as catalog from '../controllers/catalog.controller';
import type { AppEnv } from '../types';
import { publicCache } from './cache';
import { failure, json, sellingCurrency } from './openapi';

const currencyQuery = z.object({ currency: sellingCurrency });

export const countriesRoute = createRoute({
  method: 'get',
  path: '/v1/catalog/countries',
  tags: ['catalog'],
  request: { query: currencyQuery },
  responses: { 200: json(z.array(countrySchema), 'Countries with at least one plan, cheapest price first available') },
});

export const regionsRoute = createRoute({
  method: 'get',
  path: '/v1/catalog/regions',
  tags: ['catalog'],
  request: { query: currencyQuery },
  responses: { 200: json(z.array(regionSchema), 'Regional and global coverage with plans') },
});

export const countryPlansRoute = createRoute({
  method: 'get',
  path: '/v1/catalog/plans',
  tags: ['catalog'],
  request: { query: currencyQuery.extend({ country: z.string().regex(/^[A-Za-z]{2}$/) }) },
  responses: { 200: json(z.array(planSchema), 'Plans for one country, cheapest first') },
});

export const regionPlansRoute = createRoute({
  method: 'get',
  path: '/v1/catalog/regions/{id}/plans',
  tags: ['catalog'],
  request: { params: z.object({ id: z.string().min(1) }), query: currencyQuery },
  responses: { 200: json(z.array(planSchema), 'Plans for one region, cheapest first') },
});

export const planRoute = createRoute({
  method: 'get',
  path: '/v1/catalog/plans/{id}',
  tags: ['catalog'],
  request: { params: z.object({ id: z.string().min(1) }), query: currencyQuery },
  responses: {
    200: json(planSchema, 'One active plan'),
    404: failure('No active plan with that id'),
  },
});

export const offersRoute = createRoute({
  method: 'get',
  path: '/v1/offers',
  tags: ['catalog'],
  responses: { 200: json(z.array(offerSchema), 'Live offers in display order') },
});

export const catalogRoutes = new OpenAPIHono<AppEnv>();

catalogRoutes.use('/v1/catalog/*', etag(), publicCache(300, 600));
catalogRoutes.use('/v1/offers', etag(), publicCache(120, 600));

catalogRoutes
  .openapi(countriesRoute, catalog.listCountries)
  .openapi(regionsRoute, catalog.listRegions)
  .openapi(countryPlansRoute, catalog.plansForCountry)
  .openapi(regionPlansRoute, catalog.plansForRegion)
  .openapi(planRoute, catalog.getPlan)
  .openapi(offersRoute, catalog.listOffers);
