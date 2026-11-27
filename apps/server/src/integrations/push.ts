import { createPrivateKey, createSign, sign as signData, type KeyObject } from 'node:crypto';
import { connect, type ClientHttp2Session } from 'node:http2';
import type { Env } from '../env';
import type { Logger } from '../logger';

export type PushPlatform = 'ios' | 'android' | 'web';
export type PushMessage = { title: string; body: string; data: Record<string, string> };
export type PushResult = 'sent' | 'invalid_token' | 'failed';

export type LiveActivityPush = {
  event: 'update' | 'end';
  contentState: Record<string, unknown>;
  timestamp: number;
  dismissalDate?: number;
  staleDate?: number;
};

export type PushSender = {
  notify(target: { platform: PushPlatform; token: string }, message: PushMessage): Promise<PushResult>;
  liveActivity(token: string, push: LiveActivityPush): Promise<PushResult>;
};

const base64url = (input: Buffer | string) => Buffer.from(input).toString('base64url');

function pem(value: string): string {
  return value.includes('BEGIN') ? value.replace(/\\n/g, '\n') : Buffer.from(value, 'base64').toString('utf8');
}

type ApnsConfig = { keyId: string; teamId: string; privateKey: string; environment: 'sandbox' | 'production'; bundleId: string };

export function createApns(config: ApnsConfig, logger: Logger) {
  const key: KeyObject = createPrivateKey(pem(config.privateKey));
  const host = config.environment === 'production' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';
  let jwt: { token: string; issuedAt: number } | null = null;
  let session: ClientHttp2Session | null = null;

  function bearer(): string {
    const now = Math.floor(Date.now() / 1000);
    if (jwt && now - jwt.issuedAt < 50 * 60) return jwt.token;
    const header = base64url(JSON.stringify({ alg: 'ES256', kid: config.keyId }));
    const claims = base64url(JSON.stringify({ iss: config.teamId, iat: now }));
    const signature = signData('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
    jwt = { token: `${header}.${claims}.${base64url(signature)}`, issuedAt: now };
    return jwt.token;
  }

  function client(): ClientHttp2Session {
    if (session && !session.closed && !session.destroyed) return session;
    session = connect(host);
    session.on('error', (error) => logger.warn({ err: error }, 'APNs connection error'));
    session.on('goaway', () => session?.close());
    session.unref();
    return session;
  }

  function send(token: string, headers: Record<string, string>, body: unknown): Promise<PushResult> {
    return new Promise((resolve) => {
      const request = client().request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        authorization: `bearer ${bearer()}`,
        ...headers,
      });
      let status = 0;
      let text = '';
      request.setEncoding('utf8');
      request.on('response', (response) => {
        status = Number(response[':status']);
      });
      request.on('data', (chunk: string) => {
        text += chunk;
      });
      request.on('end', () => {
        if (status === 200) return resolve('sent');
        const reason = (() => {
          try {
            return (JSON.parse(text) as { reason?: string }).reason ?? '';
          } catch {
            return '';
          }
        })();
        if (status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered') return resolve('invalid_token');
        logger.warn({ status, reason }, 'APNs rejected a push');
        resolve('failed');
      });
      request.on('error', (error) => {
        logger.warn({ err: error }, 'APNs request failed');
        resolve('failed');
      });
      request.end(JSON.stringify(body));
    });
  }

  return {
    notify: (token: string, message: PushMessage) =>
      send(
        token,
        { 'apns-topic': config.bundleId, 'apns-push-type': 'alert', 'apns-priority': '10' },
        { aps: { alert: { title: message.title, body: message.body }, sound: 'default' }, body: message.data },
      ),
    liveActivity: (token: string, push: LiveActivityPush) =>
      send(
        token,
        {
          'apns-topic': `${config.bundleId}.push-type.liveactivity`,
          'apns-push-type': 'liveactivity',
          'apns-priority': push.event === 'end' ? '10' : '5',
        },
        {
          aps: {
            timestamp: push.timestamp,
            event: push.event,
            'content-state': push.contentState,
            ...(push.staleDate ? { 'stale-date': push.staleDate } : {}),
            ...(push.dismissalDate ? { 'dismissal-date': push.dismissalDate } : {}),
          },
        },
      ),
  };
}

type ServiceAccount = { project_id: string; client_email: string; private_key: string };

export function createFcm(serviceAccountJson: string, logger: Logger, request: typeof fetch = fetch) {
  const account = JSON.parse(
    serviceAccountJson.trim().startsWith('{') ? serviceAccountJson : Buffer.from(serviceAccountJson, 'base64').toString('utf8'),
  ) as ServiceAccount;
  let access: { token: string; expiresAt: number } | null = null;

  async function accessToken(): Promise<string> {
    if (access && access.expiresAt - 60_000 > Date.now()) return access.token;
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(
      JSON.stringify({
        iss: account.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    );
    const signer = createSign('RSA-SHA256');
    signer.update(`${header}.${claims}`);
    const assertion = `${header}.${claims}.${signer.sign(account.private_key.replace(/\\n/g, '\n'), 'base64url')}`;
    const response = await request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    if (!response.ok) throw new Error(`Google token exchange failed with ${response.status}`);
    const body = (await response.json()) as { access_token: string; expires_in: number };
    access = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
    return access.token;
  }

  return {
    async notify(token: string, message: PushMessage): Promise<PushResult> {
      try {
        const response = await request(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
          method: 'POST',
          headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: message.title, body: message.body },
              data: message.data,
              android: { priority: 'high', notification: { channel_id: 'trips' } },
            },
          }),
        });
        if (response.ok) return 'sent';
        const text = await response.text();
        if (response.status === 404 || text.includes('UNREGISTERED')) return 'invalid_token';
        logger.warn({ status: response.status }, 'FCM rejected a push');
        return 'failed';
      } catch (error) {
        logger.warn({ err: error }, 'FCM request failed');
        return 'failed';
      }
    },
  };
}

export type SentPush =
  | { kind: 'notify'; platform: PushPlatform; token: string; message: PushMessage }
  | { kind: 'liveActivity'; token: string; push: LiveActivityPush };

export function createMemoryPush(): PushSender & { sent: SentPush[]; invalid: Set<string> } {
  const sent: SentPush[] = [];
  const invalid = new Set<string>();
  return {
    sent,
    invalid,
    async notify(target, message) {
      if (invalid.has(target.token)) return 'invalid_token';
      sent.push({ kind: 'notify', platform: target.platform, token: target.token, message });
      return 'sent';
    },
    async liveActivity(token, push) {
      if (invalid.has(token)) return 'invalid_token';
      sent.push({ kind: 'liveActivity', token, push });
      return 'sent';
    },
  };
}

function consolePush(logger: Logger): PushSender {
  return {
    async notify(target, message) {
      logger.info({ platform: target.platform, title: message.title, body: message.body, data: message.data }, 'push not sent (console route)');
      return 'sent';
    },
    async liveActivity(_token, push) {
      logger.info({ event: push.event, state: push.contentState }, 'Live Activity push not sent (console route)');
      return 'sent';
    },
  };
}

export function createPushSender(env: Env, logger: Logger): PushSender {
  if (env.PUSH_ROUTE !== 'live') return consolePush(logger);
  const apns = createApns(
    {
      keyId: env.APNS_KEY_ID ?? '',
      teamId: env.APNS_TEAM_ID ?? '',
      privateKey: env.APNS_PRIVATE_KEY ?? '',
      environment: env.APNS_ENV,
      bundleId: env.APPLE_BUNDLE_ID,
    },
    logger,
  );
  const fcm = createFcm(env.FCM_SERVICE_ACCOUNT ?? '', logger);
  return {
    async notify(target, message) {
      if (target.platform === 'ios') return apns.notify(target.token, message);
      if (target.platform === 'android') return fcm.notify(target.token, message);
      return 'failed';
    },
    liveActivity: (token, push) => apns.liveActivity(token, push),
  };
}
