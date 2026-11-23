'use client';

import { createHttpApi, createMockApi } from '@vela/api';

const mock = createMockApi({ latencyMs: 450 });
const baseUrl = process.env.NEXT_PUBLIC_API_URL;

export const browserApi = baseUrl ? createHttpApi({ baseUrl, fallback: mock, currency: () => 'INR', credentials: 'include' }) : mock;
