import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { HttpError } from './lib/errors';
import { catalogRoutes } from './routes/catalog';
import { adminRoutes } from './routes/admin';
import { blogRoutes } from './routes/blog';
import { deviceRoutes } from './routes/devices';
import { esimWebhookRoutes } from './routes/esimWebhooks';
import { meRoutes } from './routes/me';
import { orderRoutes, webhookRoutes } from './routes/orders';
import { supportRoutes } from './routes/support';
import { systemRoutes } from './routes/system';
import { captureError } from './sentry';
import type { AppDeps, AppEnv } from './types';

export function createApp(deps: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          { error: { code: 'invalid_request', message: 'Request validation failed', issues: result.error.issues } },
          400,
        );
      }
      return undefined;
    },
  });

  app.use('*', requestId());
  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: deps.env.CORS_ORIGINS,
      allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
      maxAge: 600,
    }),
  );
  app.use('*', async (c, next) => {
    const started = performance.now();
    const logger = deps.logger.child({ requestId: c.var.requestId });
    c.set('deps', deps);
    c.set('logger', logger);
    await next();
    logger.info(
      { method: c.req.method, path: c.req.path, status: c.res.status, ms: Math.round(performance.now() - started) },
      'request',
    );
  });

  app.route('/', systemRoutes);
  app.route('/', catalogRoutes);
  app.route('/', blogRoutes);
  app.route('/', meRoutes);
  app.route('/', orderRoutes);
  app.route('/', deviceRoutes);
  app.route('/', supportRoutes);
  app.route('/', adminRoutes);
  app.route('/', webhookRoutes);
  app.route('/', esimWebhookRoutes);
  app.on(['GET', 'POST'], '/v1/auth/*', (c) => deps.auth.handler(c.req.raw));

  app.openAPIRegistry.registerComponent('securitySchemes', 'bearer', { type: 'http', scheme: 'bearer' });

  app.doc31('/v1/openapi.json', {
    openapi: '3.1.0',
    info: { title: 'vela API', version: deps.version },
    servers: [{ url: '/' }],
  });

  app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Route not found' } }, 404));

  app.onError((error, c) => {
    if (error instanceof HttpError) {
      return c.json({ error: { code: error.code, message: error.message } }, error.status);
    }
    captureError(error, { path: c.req.path, requestId: c.var.requestId });
    c.var.logger?.error({ err: error }, 'unhandled error');
    return c.json({ error: { code: 'internal', message: 'Something went wrong' } }, 500);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;
