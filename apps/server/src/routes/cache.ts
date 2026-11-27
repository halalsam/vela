import type { MiddlewareHandler } from 'hono';

/** Sets a public Cache-Control header on successful responses. */
export const publicCache =
  (maxAge: number, staleWhileRevalidate: number): MiddlewareHandler =>
  async (c, next) => {
    await next();
    if (c.res.status === 200) c.header('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
  };
