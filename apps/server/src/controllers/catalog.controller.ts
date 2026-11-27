import { notFound } from '../lib/errors';
import type * as routes from '../routes/catalog.routes';
import * as catalog from '../services/catalog.service';
import type { Handler } from '../types';

export const listCountries: Handler<typeof routes.countriesRoute> = async (c) =>
  c.json(await catalog.listCountries(c.var.deps.db, c.req.valid('query').currency), 200);

export const listRegions: Handler<typeof routes.regionsRoute> = async (c) =>
  c.json(await catalog.listRegions(c.var.deps.db, c.req.valid('query').currency), 200);

export const plansForCountry: Handler<typeof routes.countryPlansRoute> = async (c) => {
  const { country, currency } = c.req.valid('query');
  return c.json(await catalog.plansForCountry(c.var.deps.db, country, currency), 200);
};

export const plansForRegion: Handler<typeof routes.regionPlansRoute> = async (c) =>
  c.json(await catalog.plansForRegion(c.var.deps.db, c.req.valid('param').id, c.req.valid('query').currency), 200);

export const getPlan: Handler<typeof routes.planRoute> = async (c) => {
  const plan = await catalog.planById(c.var.deps.db, c.req.valid('param').id, c.req.valid('query').currency);
  if (!plan) throw notFound('Plan');
  return c.json(plan, 200);
};

export const listOffers: Handler<typeof routes.offersRoute> = async (c) => c.json(await catalog.listOffers(c.var.deps.db), 200);
