'use client';

import type { Esim, SupportChat as Chat, SupportChatSummary } from '@vela/api';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button, Card, focusRing } from '@/components/ui';
import { browserApi } from '@/lib/browserApi';
import { format, type Dictionary, type Locale } from '@/lib/i18n';
import { cn, type } from '@/lib/type';

const POLL = 5000;
const live = Boolean(process.env.NEXT_PUBLIC_API_URL);

type Labels = Dictionary['account'];

const fieldClass = cn(
  type.callout,
  'h-button-compact rounded-button border border-line bg-surface-1 px-3 text-fg outline-none placeholder:text-fg-tertiary focus:border-fg-tertiary',
);

function time(iso: string, locale: Locale) {
  return new Date(iso).toLocaleTimeString(locale === 'ar' ? 'ar' : 'en-IN', { hour: 'numeric', minute: '2-digit' });
}

function statusLabel(labels: Labels, status: SupportChatSummary['status']) {
  return { open: labels.chatStatusOpen, pending: labels.chatStatusPending, resolved: labels.chatStatusResolved }[status];
}

function chatTitle(labels: Labels, chat: SupportChatSummary) {
  return [format(labels.chatNumber, { number: chat.number }), chat.esim?.label, statusLabel(labels, chat.status)].filter(Boolean).join(' · ');
}

function RatingCard({ labels, onRate, onLater }: { labels: Labels; onRate: (score: number, comment: string | null) => Promise<void>; onLater: () => void }) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!score) return;
    setBusy(true);
    try {
      await onRate(score, comment.trim() || null);
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
        <input aria-label={labels.rateComment} placeholder={labels.rateComment} value={comment} maxLength={500} onChange={(event) => setComment(event.target.value)} className={fieldClass} />
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" disabled={!score || busy} onClick={() => void send()}>
          {labels.rateSend}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onLater}>
          {labels.rateLater}
        </Button>
      </div>
    </div>
  );
}

/** Support chats (tickets), shared with the app. Signed-in customers only. */
export function SupportChat({ locale, labels, esims }: { locale: Locale; labels: Labels; esims: Esim[] }) {
  const [chats, setChats] = useState<SupportChatSummary[] | null>(null);
  const [current, setCurrent] = useState<Chat | null>(null);
  /** The chat on screen. `new` shows the new-chat form; null means "the most recent one". */
  const [selected, setSelected] = useState<string | 'new' | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState('');
  const [plan, setPlan] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [ratingHidden, setRatingHidden] = useState<string | null>(null);
  const [thanked, setThanked] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLElement>(null);

  const list = chats ?? [];
  const activeId = selected === 'new' ? null : (selected ?? list[0]?.id ?? null);
  const composing = selected === 'new' || (chats !== null && list.length === 0);
  const shown = current && current.chat.id === activeId ? current : null;
  const count = shown?.messages.length ?? 0;

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      browserApi.getSupportChats().then(
        async (next) => {
          if (cancelled) return;
          setChats(next);
          setFailed(false);
          const id = selected === 'new' ? null : (selected ?? next[0]?.id ?? null);
          if (!id) return;
          const chat = await browserApi.getSupportChat(id).catch(() => null);
          if (!cancelled && chat) setCurrent(chat);
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
  }, [attempt, selected]);

  // Keep the newest message in view inside the chat box (not the page).
  useEffect(() => {
    const box = scroller.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [count, activeId]);

  // Arriving from a "Chat with us" link.
  useEffect(() => {
    if (window.location.hash === '#support') section.current?.scrollIntoView({ block: 'start' });
  }, []);

  function upsert(chat: Chat) {
    setCurrent(chat);
    setChats((existing) => [chat.chat, ...(existing ?? []).filter((item) => item.id !== chat.chat.id)]);
  }

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setSendFailed(false);
    try {
      if (composing) {
        const chat = await browserApi.startSupportChat({ text, iccid: plan || null });
        upsert(chat);
        setSelected(chat.chat.id);
        setPlan('');
      } else if (activeId) {
        upsert(await browserApi.sendSupportChatMessage(activeId, text));
      }
      setDraft('');
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

  const loading = chats === null || (!composing && shown === null && !failed);

  return (
    <section ref={section} id="support" aria-labelledby="support-title" className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="support-title" className={cn(type.label, 'text-fg-tertiary')}>
          {labels.chatTitle}
        </h2>
        <p className={cn(type.callout, 'max-w-2xl text-fg-secondary')}>{labels.chatIntro}</p>
      </div>
      <Card className="flex flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 md:px-4">
          {list.length > 0 ? (
            <select
              aria-label={labels.chatYours}
              value={composing ? '' : (activeId ?? '')}
              onChange={(event) => {
                setSendFailed(false);
                setSelected(event.target.value || 'new');
              }}
              className={cn(fieldClass, 'min-w-0 max-w-full flex-1 md:flex-none')}
            >
              {composing ? <option value="">{labels.chatNew}</option> : null}
              {list.map((item) => (
                <option key={item.id} value={item.id}>
                  {chatTitle(labels, item)}
                </option>
              ))}
            </select>
          ) : null}
          {shown?.chat.esim ? (
            <span className={cn(type.caption, 'rounded-chip bg-accent-tint px-2 py-1 text-accent')}>{format(labels.chatAbout, { plan: shown.chat.esim.label })}</span>
          ) : null}
          {composing && list.length > 0 ? (
            <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setSelected(null)}>
              {labels.chatCancel}
            </Button>
          ) : !composing ? (
            <Button
              size="sm"
              variant="secondary"
              className="ms-auto"
              onClick={() => {
                setDraft('');
                setSendFailed(false);
                setSelected('new');
              }}
            >
              {labels.chatNew}
            </Button>
          ) : null}
        </div>
        <div ref={scroller} className="flex h-[420px] flex-col gap-3 overflow-y-auto p-4 md:p-5" aria-live="polite" aria-busy={loading}>
          {failed && chats === null ? (
            <div className="m-auto flex flex-col items-center gap-3">
              <p role="alert" className={type.callout}>
                {labels.chatError}
              </p>
              <Button size="sm" variant="secondary" onClick={() => setAttempt((value) => value + 1)}>
                {labels.retry}
              </Button>
            </div>
          ) : composing ? (
            <div className="m-auto flex w-full max-w-md flex-col gap-4">
              <p className={cn(type.callout, 'text-fg-secondary')}>{labels.chatNewIntro}</p>
              {esims.length > 0 ? (
                <label className="flex flex-col gap-2">
                  <span className={cn(type.label, 'text-fg-tertiary')}>{labels.chatPlan}</span>
                  <select value={plan} onChange={(event) => setPlan(event.target.value)} className={fieldClass}>
                    <option value="">{labels.chatNoPlan}</option>
                    {esims.map((item) => (
                      <option key={item.iccid} value={item.iccid}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : loading || !shown ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((key) => (
                <div key={key} className={cn('h-10 w-1/2 animate-pulse rounded-card bg-surface-2 motion-reduce:animate-none', key === 1 && 'self-end')} />
              ))}
            </div>
          ) : (
            <>
              {shown.messages.map((message) => {
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
              {shown.chat.rating_asked && ratingHidden !== shown.chat.id ? (
                <RatingCard
                  labels={labels}
                  onLater={() => setRatingHidden(shown.chat.id)}
                  onRate={async (score, comment) => {
                    await browserApi.rateSupportChat(shown.chat.id, score, comment);
                    setThanked(shown.chat.id);
                    upsert({ ...shown, chat: { ...shown.chat, rating_asked: false } });
                  }}
                />
              ) : null}
              {thanked === shown.chat.id ? <p className={cn(type.caption, 'self-center text-fg-tertiary')}>{labels.rateThanks}</p> : null}
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
              disabled={chats === null && !failed}
              placeholder={labels.chatPlaceholder}
              aria-label={labels.chatPlaceholder}
              aria-describedby="support-hint"
              className={cn(type.body, 'min-h-12 flex-1 resize-none rounded-button border border-line bg-surface-1 px-4 py-3 text-fg outline-none placeholder:text-fg-tertiary focus:border-fg-tertiary')}
            />
            <Button type="submit" disabled={!draft.trim() || sending || (chats === null && !failed)}>
              {sending ? labels.chatSending : composing ? labels.chatStart : labels.chatSend}
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
