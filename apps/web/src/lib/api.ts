import { createHttpApi, createMockApi } from '@vela/api';

const mock = createMockApi({ latencyMs: 0 });
const baseUrl = process.env.VELA_API_URL;

export const serverApi = baseUrl
  ? createHttpApi({
      baseUrl,
      fallback: mock,
      currency: () => 'INR',
      fetch: (url, init) => fetch(url, { ...init, next: { revalidate: 600 } }),
    })
  : mock;
