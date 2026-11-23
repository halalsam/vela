import type { Env } from '../env';
import type { Logger } from '../logger';

export type SmsSender = {
  sendCode(phoneNumber: string, code: string): Promise<void>;
};

export type SentCode = { phoneNumber: string; code: string };

export function createMemorySms(): SmsSender & { sent: SentCode[] } {
  const sent: SentCode[] = [];
  return {
    sent,
    async sendCode(phoneNumber, code) {
      sent.push({ phoneNumber, code });
    },
  };
}

function consoleSms(logger: Logger): SmsSender {
  return {
    async sendCode(phoneNumber, code) {
      logger.warn({ phoneNumber, code }, 'SMS not sent (console route); use this code');
    },
  };
}

async function postOrThrow(url: string, init: RequestInit, provider: string) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${provider} SMS failed with ${response.status}: ${await response.text()}`);
}

function liveSms(env: Env): SmsSender {
  return {
    async sendCode(phoneNumber, code) {
      if (phoneNumber.startsWith('+91')) {
        await postOrThrow(
          'https://control.msg91.com/api/v5/flow',
          {
            method: 'POST',
            headers: { authkey: env.MSG91_AUTH_KEY ?? '', 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ template_id: env.MSG91_TEMPLATE_ID, recipients: [{ mobiles: phoneNumber.slice(1), otp: code }] }),
          },
          'MSG91',
        );
        return;
      }
      const body = new URLSearchParams({ To: phoneNumber, From: env.TWILIO_FROM ?? '', Body: `${code} is your vela code. It expires in 5 minutes.` });
      await postOrThrow(
        `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body,
        },
        'Twilio',
      );
    },
  };
}

export function createSmsSender(env: Env, logger: Logger): SmsSender {
  return env.SMS_ROUTE === 'live' ? liveSms(env) : consoleSms(logger);
}
