import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import { phoneNumberClient } from 'better-auth/client/plugins';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { useDevStore } from '@/stores/dev';
import { useSession, type SignInProvider } from '@/stores/session';

const baseURL = process.env.EXPO_PUBLIC_API_URL;
const MOCK_LATENCY = 700;

export const authClient = baseURL
  ? createAuthClient({
      baseURL,
      basePath: '/v1/auth',
      plugins: [expoClient({ scheme: 'vela', storagePrefix: 'vela', storage: SecureStore }), phoneNumberClient()],
    })
  : null;

export class SignInError extends Error {
  constructor(
    readonly reason: 'cancelled' | 'wrong_code' | 'failed',
    message: string = reason,
  ) {
    super(message);
    this.name = 'SignInError';
  }
}

function mockDelay(provider: SignInProvider): Promise<void> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      if (useDevStore.getState().scenario === 'error') reject(new SignInError('failed'));
      else resolve();
      void provider;
    }, MOCK_LATENCY),
  );
}

function fail(error: { status?: number; message?: string } | null | undefined): never {
  throw new SignInError(error?.status === 400 || error?.status === 403 ? 'wrong_code' : 'failed', error?.message);
}

export async function authHeaders(): Promise<Record<string, string>> {
  if (!authClient) return {};
  const cookie = await authClient.getCookie();
  return cookie ? { cookie } : {};
}

export async function signInWithApple() {
  if (!authClient) {
    await mockDelay('apple');
  } else {
    let identityToken: string | null = null;
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      identityToken = credential.identityToken;
    } catch (error) {
      if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new SignInError('cancelled');
      throw new SignInError('failed');
    }
    if (!identityToken) throw new SignInError('failed');
    const result = await authClient.signIn.social({ provider: 'apple', idToken: { token: identityToken } });
    if (result.error) fail(result.error);
  }
  useSession.getState().signIn('apple');
}

export async function signInWithGoogle() {
  if (!authClient) {
    await mockDelay('google');
  } else {
    const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
    if (result.error) fail(result.error);
    const session = await authClient.getSession();
    if (!session.data) throw new SignInError('cancelled');
  }
  useSession.getState().signIn('google');
}

export async function sendPhoneCode(phoneNumber: string) {
  if (!authClient) return mockDelay('phone');
  const result = await authClient.phoneNumber.sendOtp({ phoneNumber });
  if (result.error) fail(result.error);
}

export const DEMO_WRONG_CODE = '000000';

export async function verifyPhoneCode(phoneNumber: string, code: string) {
  if (!authClient) {
    if (code === DEMO_WRONG_CODE) throw new SignInError('wrong_code');
    await mockDelay('phone');
  } else {
    const result = await authClient.phoneNumber.verify({ phoneNumber, code });
    if (result.error) fail(result.error);
  }
  useSession.getState().signIn('phone');
}

export async function signOutEverywhere() {
  if (authClient) await authClient.signOut().catch(() => undefined);
  useSession.getState().signOut();
}

export async function deleteAccount() {
  if (authClient && baseURL) {
    const response = await fetch(`${baseURL.replace(/\/$/, '')}/v1/me`, { method: 'DELETE', headers: await authHeaders() });
    if (!response.ok && response.status !== 401) throw new SignInError('failed');
  }
  await signOutEverywhere();
}

export async function confirmStoredSession() {
  if (!authClient || !useSession.getState().signedIn) return;
  const session = await authClient.getSession().catch(() => null);
  if (session && !session.error && !session.data) useSession.getState().signOut();
}
