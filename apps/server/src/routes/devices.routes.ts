import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { dailyUsageSchema } from '@vela/api';
import * as devices from '../controllers/devices.controller';
import type { AppEnv } from '../types';
import { failure, iccidParam as iccid, signedIn } from './openapi';

const done = { description: 'Done' };
const body = <T extends z.ZodType>(schema: T) => ({ body: { content: { 'application/json': { schema } } } });
const token = z.string().min(8).max(512);
const locale = z.string().min(2).max(16).default('en');
const iccidParam = z.object({ iccid });

export const registerDevice = createRoute({
  method: 'post',
  path: '/v1/devices',
  tags: ['notifications'],
  ...signedIn,
  request: body(z.object({ platform: z.enum(['ios', 'android']), push_token: token, locale })),
  responses: { 204: done, 401: failure('Not signed in') },
});

export const removeDevice = createRoute({
  method: 'delete',
  path: '/v1/devices',
  tags: ['notifications'],
  ...signedIn,
  request: body(z.object({ push_token: token })),
  responses: { 204: done, 401: failure('Not signed in') },
});

export const startActivity = createRoute({
  method: 'post',
  path: '/v1/esims/{iccid}/live-activity',
  tags: ['notifications'],
  ...signedIn,
  request: { params: iccidParam, ...body(z.object({ push_token: token, locale, device_token: token.optional() })) },
  responses: { 204: done, 401: failure('Not signed in'), 404: failure('eSIM not found') },
});

export const endActivity = createRoute({
  method: 'delete',
  path: '/v1/esims/{iccid}/live-activity',
  tags: ['notifications'],
  ...signedIn,
  request: { params: iccidParam },
  responses: { 204: done, 401: failure('Not signed in'), 404: failure('eSIM not found') },
});

export const dailyRoute = createRoute({
  method: 'get',
  path: '/v1/esims/{iccid}/usage/daily',
  tags: ['esims'],
  ...signedIn,
  request: { params: iccidParam },
  responses: {
    200: { description: 'Data used per day for the last 7 days, oldest first', content: { 'application/json': { schema: z.array(dailyUsageSchema) } } },
    401: failure('Not signed in'),
    404: failure('eSIM not found'),
  },
});

export const deviceRoutes = new OpenAPIHono<AppEnv>()
  .openapi(registerDevice, devices.register)
  .openapi(removeDevice, devices.remove)
  .openapi(startActivity, devices.startLiveActivity)
  .openapi(endActivity, devices.endLiveActivity)
  .openapi(dailyRoute, devices.dailyUsage);
