'use client';

import type { SupportMessage } from '@vela/api';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button, Card, focusRing } from '@/components/ui';
import { browserApi } from '@/lib/browserApi';
import { format, type Dictionary, type Locale } from '@/lib/i18n';
import { cn, type } from '@/lib/type';

const POLL = 5000;
const live = Boolean(process.env.NEXT_PUBLIC_API_URL);

type Labels = Dictionary['account'];

function time(iso: string, locale: Locale) {
  return new Date(iso).toLocaleTimeString(locale === 'ar' ? 'ar' : 'en-IN', { hour: 'numeric', minute: '2-digit' });
}

function RatingCard({ labels, onDone }: { labels: Labels; onDone: (rated: boolean) => void }) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!score) return;
    setBusy(true);
    try {
      await browserApi.rateSupport(score, comment.trim() || null);
      onDone(true);
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card border border-line bg-surface-2 p-4">
      <div className="flex flex-col gap-1">
        <p className={type.bodyStrong}>{labels.rateTitle}</p>
        <p className={cn(type.callout, 'text-fg-secondary')}>{labels.rateBody}</p>
      </div>
      <div role="radiogroup" aria-label={labels.rateTitle} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={score === value}
            aria-label={format(labels.rateStar, { count: String(value) })}
            disabled={busy}
            onClick={() => setScore(value)}
            className={cn('flex h-11 w-11 items-center justify-center rounded-button text-[28px] leading-none', value <= score ? 'text-accent' : 'text-fg-quaternary hover:text-fg-tertiary', focusRing)}
          >
            {value <= score ? '★' : '☆'}
          </button>
        ))}
      </div>
      {score ? (
        <input
          aria-label={labels.rateComment}
          placeholder={labels.rateComment}
          value={comment}
          maxLength={500}
          onChange={(event) => setComment(event.target.value)}
          className={cn(type.callout, 'h-button-compact rounded-button border border-line bg-surface-1 px-3 text-fg outline-none placeholder:text-fg-tertiary focus:border-fg-tertiary')}
        />
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={!score || busy} onClick={() => void send()}>
          {labels.rateSend}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDone(false)}>
          {labels.rateLater}
        </Button>
      </div>
    </div>
  );
}

/** The same support conversation as the app's chat. Signed-in customers only. */
export function SupportChat({ locale, labels }: { locale: Locale; labels: Labels }) {
  const [thread, setThread] = useState<SupportMessage[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [ratingAsked, setRatingAsked] = useState(false);
  const [ratingClosed, setRatingClosed] = useState(false);
  const [thanked, setThanked] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);
  const count = thread?.length ?? 0;

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      Promise.all([browserApi.getSupportThread(), browserApi.getSupportRating().catch(() => ({ asked: false }))]).then(
        ([messages, rating]) => {
          if (cancelled) return;
          setThread(messages);
          setRatingAsked(rating.asked);
          setFailed(false);
        },
        () => !cancelled && setFailed(true),
      );
    void load();
    const timer = live
      ? setInterval(() => {
          if (document.visibilityState === 'visible') void load();
        }, POLL)
      : undefined;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [attempt]);

  // Keep the newest message in view inside the chat box (not the page).
  useEffect(() => {
    const box = scroller.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [count, ratingAsked]);

  // Arriving from a "Chat with us" link.
  useEffect(() => {
    if (window.location.hash === '#support') section.current?.scrollIntoView({ block: 'start' });
  }, []);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setSendFailed(false);
    try {
      setThread(await browserApi.sendSupportMessage(text));
      setDraft('');
      // Writing again reopens the chat, so the rating request is gone.
      setRatingAsked(false);
    } catch {
      setSendFailed(true);
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  function keys(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <section ref={section} id="support" aria-labelledby="support-title" className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="support-title" className={cn(type.label, 'text-fg-tertiary')}>
          {labels.chatTitle}
        </h2>
        <p className={cn(type.callout, 'max-w-2xl text-fg-secondary')}>{labels.chatIntro}</p>
      </div>
      <Card className="flex flex-col overflow-hidden">
        <div ref={scroller} className="flex h-[420px] flex-col gap-3 overflow-y-auto p-4 md:p-5" aria-live="polite" aria-busy={thread === null}>
          {failed && thread === null ? (
            <div className="m-auto flex flex-col items-center gap-3">
              <p role="alert" className={type.callout}>
                {labels.chatError}
              </p>
              <Button size="sm" variant="secondary" onClick={() => setAttempt((value) => value + 1)}>
                {labels.retry}
              </Button>
            </div>
          ) : thread === null ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((key) => (
                <div key={key} className={cn('h-10 w-1/2 animate-pulse rounded-card bg-surface-2 motion-reduce:animate-none', key === 1 && 'self-end')} />
              ))}
            </div>
          ) : (
            <>
              {thread.map((message) => {
                const mine = message.from === 'user';
                return (
                  <div key={message.id} className={cn('flex max-w-[85%] flex-col gap-1 md:max-w-[70%]', mine ? 'items-end self-end' : 'items-start self-start')}>
                    <p
                      dir="auto"
                      className={cn(type.callout, 'whitespace-pre-wrap break-words rounded-card px-4 py-2.5', mine ? 'bg-fg text-fg-inverse' : 'border border-line bg-surface-2')}
                    >
                      {message.text}
                    </p>
                    <span className={cn(type.caption, 'text-fg-tertiary')}>
                      {mine ? labels.chatYou : labels.chatAgent} · <span dir="ltr">{time(message.sent_at, locale)}</span>
                    </span>
                  </div>
                );
              })}
              {ratingAsked && !ratingClosed ? (
                <RatingCard
                  labels={labels}
                  onDone={(rated) => {
                    setRatingClosed(true);
                    setThanked(rated);
                  }}
                />
              ) : null}
              {thanked ? <p className={cn(type.caption, 'self-center text-fg-tertiary')}>{labels.rateThanks}</p> : null}
            </>
          )}
        </div>
        <form onSubmit={submit} className="flex flex-col gap-2 border-t border-line p-3 md:p-4">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={keys}
              rows={2}
              maxLength={2000}
              dir="auto"
              disabled={thread === null}
              placeholder={labels.chatPlaceholder}
              aria-label={labels.chatPlaceholder}
              aria-describedby="support-hint"
              className={cn(type.body, 'min-h-12 flex-1 resize-none rounded-button border border-line bg-surface-1 px-4 py-3 text-fg outline-none placeholder:text-fg-tertiary focus:border-fg-tertiary')}
            />
            <Button type="submit" disabled={!draft.trim() || sending || thread === null}>
              {sending ? labels.chatSending : labels.chatSend}
            </Button>
          </div>
          {sendFailed ? (
            <p role="alert" className={cn(type.caption, 'text-danger')}>
              {labels.chatSendFailed}
            </p>
          ) : (
            <p id="support-hint" className={cn(type.caption, 'hidden text-fg-tertiary md:block')}>
              {labels.chatHint}
            </p>
          )}
        </form>
      </Card>
    </section>
  );
}
