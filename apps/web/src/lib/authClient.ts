'use client';

import { phoneNumberClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

const baseURL = process.env.NEXT_PUBLIC_API_URL;

export const authClient = baseURL
  ? createAuthClient({
      baseURL,
      basePath: '/v1/auth',
      fetchOptions: { credentials: 'include' },
      plugins: [phoneNumberClient()],
    })
  : null;
