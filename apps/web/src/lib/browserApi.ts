'use client';

import { createHttpApi, createMockApi } from '@vela/api';
import { readCurrency } from './currency';

const mock = createMockApi({ latencyMs: 450 });
const baseUrl = process.env.NEXT_PUBLIC_API_URL;

export const browserApi = baseUrl ? createHttpApi({ baseUrl, fallback: mock, currency: readCurrency, credentials: 'include' }) : mock;
