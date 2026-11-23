import type { Env } from '../../env';
import type { Logger } from '../../logger';

export type EmailAttachment = { filename: string; content: string };
export type EmailMessage = { to: string; subject: string; html: string; text: string; attachments?: EmailAttachment[]; idempotencyKey?: string };

export type EmailSender = { send(message: EmailMessage): Promise<void> };

export function createMemoryEmail(): EmailSender & { sent: EmailMessage[] } {
  const sent: EmailMessage[] = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
    },
  };
}

function consoleEmail(logger: Logger): EmailSender {
  return {
    async send(message) {
      logger.info({ to: message.to, subject: message.subject, attachments: message.attachments?.map((item) => item.filename) }, 'email not sent (console route)');
    },
  };
}

export function createResend(config: { apiKey: string; from: string; fetch?: typeof fetch }): EmailSender {
  const request = config.fetch ?? fetch;
  return {
    async send(message) {
      const response = await request('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          'content-type': 'application/json',
          ...(message.idempotencyKey ? { 'idempotency-key': message.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: config.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.attachments?.length ? { attachments: message.attachments } : {}),
        }),
      });
      if (!response.ok) throw new Error(`Resend failed with ${response.status}: ${(await response.text()).slice(0, 200)}`);
    },
  };
}

export function createEmailSender(env: Env, logger: Logger): EmailSender {
  if (env.EMAIL_ROUTE === 'live') return createResend({ apiKey: env.RESEND_API_KEY ?? '', from: env.EMAIL_FROM ?? '' });
  return consoleEmail(logger);
}
