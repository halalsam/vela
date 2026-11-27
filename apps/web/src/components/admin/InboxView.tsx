"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Button, Card, Field, Pill } from "@/components/ui";
import {
  adminFetch,
  ago,
  conversationLabel,
  conversationTone,
  money,
  personName,
  statusTone,
  when,
  type AdminConversation,
  type AdminConversationRow,
  type AdminStaff,
  type ConversationStatus,
  type SavedReply,
  type SupportStats,
} from "@/lib/adminApi";
import { cn, type } from "@/lib/type";
import { useStaffRole } from "./AdminShell";
import { Empty, ErrorNote, Select, Skeleton, Stat, usePolled } from "./kit";

const POLL = 5000;
const TABS: { value: ConversationStatus | "all"; label: string }[] = [
  { value: "open", label: "Needs reply" },
  { value: "pending", label: "Waiting" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
];

function Stats() {
  const { data } = usePolled<SupportStats>(
    "/v1/admin/conversations/stats",
    30_000,
  );
  if (!data) return <Skeleton className="h-[88px]" />;
  return (
    <div className="grid grid-cols-2 gap-card-gap md:grid-cols-5">
      <Stat
        label="Needs reply"
        value={data.open}
        hint={
          data.unassigned ? `${data.unassigned} unassigned` : "All assigned"
        }
      />
      <Stat label="Waiting on customer" value={data.pending} />
      <Stat label="Resolved, 24h" value={data.resolved_24h} />
      <Stat
        label="First reply, 7 days"
        value={
          data.median_first_reply_minutes === null
            ? "–"
            : `${data.median_first_reply_minutes} min`
        }
        hint="Median"
      />
      <Stat
        label="Rating, 30 days"
        value={
          data.rating_30d ? `${data.rating_30d.average.toFixed(1)} / 5` : "–"
        }
        hint={
          data.rating_30d
            ? `${data.rating_30d.count} ratings`
            : "No ratings yet"
        }
      />
    </div>
  );
}

function useNow(every = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(timer);
  }, [every]);
  return now;
}

function ConversationList({
  rows,
  selected,
  onSelect,
}: {
  rows: AdminConversationRow[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const now = useNow();
  if (rows.length === 0) return <Empty>Nothing here. Nice.</Empty>;
  return (
    <Card className="overflow-hidden">
      <ul className="flex flex-col">
        {rows.map((row) => {
          const active = row.id === selected;
          return (
            <li key={row.id} className="border-t border-line first:border-t-0">
              <button
                type="button"
                onClick={() => onSelect(row.id)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex w-full flex-col gap-1 px-4 py-3 text-start transition-colors duration-fast",
                  active ? "bg-surface-2" : "hover:bg-surface-2/60",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      row.unread ? type.calloutStrong : type.callout,
                      "min-w-0 flex-1 truncate",
                    )}
                  >
                    {personName(row.customer)}
                  </span>
                  <span
                    className={cn(
                      type.caption,
                      "text-fg-tertiary tabular-nums",
                    )}
                  >
                    #{row.number}
                  </span>
                  {row.unread ? (
                    <span
                      className={cn(
                        type.caption,
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-accent px-1.5 text-fg-inverse",
                      )}
                      aria-label={`${row.unread} unread`}
                    >
                      {row.unread}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      type.caption,
                      "tabular-nums",
                      row.waiting_since &&
                        now - Date.parse(row.waiting_since) > 30 * 60_000
                        ? "text-warning"
                        : "text-fg-tertiary",
                    )}
                  >
                    {ago(row.waiting_since ?? row.last_message_at, now)}
                  </span>
                </span>
                <span
                  className={cn(type.caption, "line-clamp-2 text-fg-secondary")}
                  dir="auto"
                >
                  {row.last_message
                    ? `${row.last_message.internal ? "Note: " : row.last_message.from === "agent" ? "You: " : ""}${row.last_message.text}`
                    : "No messages"}
                </span>
                <span className="flex items-center gap-2">
                  {row.status !== "open" ? (
                    <Pill tone={conversationTone[row.status]}>
                      {conversationLabel[row.status]}
                    </Pill>
                  ) : null}
                  {row.esim ? (
                    <Pill tone="accent">{row.esim.label}</Pill>
                  ) : null}
                  <span className={cn(type.caption, "text-fg-tertiary")}>
                    {row.assignee ? row.assignee.name : "Unassigned"}
                  </span>
                  {row.customer.language.startsWith("ar") ? (
                    <span className={cn(type.caption, "text-fg-tertiary")}>
                      · Arabic
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Composer({
  chatId,
  onSent,
}: {
  chatId: string;
  onSent: (next: AdminConversation) => void;
}) {
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const replies = usePolled<SavedReply[]>("/v1/admin/saved-replies");
  const box = useRef<HTMLTextAreaElement>(null);

  async function send(status?: ConversationStatus) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await adminFetch<AdminConversation>(
        `/v1/admin/conversations/${encodeURIComponent(chatId)}/messages`,
        {
          method: "POST",
          body: {
            text: trimmed,
            internal: mode === "note",
            ...(status && mode === "reply" ? { status } : {}),
          },
        },
      );
      setText("");
      onSent(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn’t send");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  function keys(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        "flex flex-col gap-3 border-t border-line p-4",
        mode === "note" && "bg-warning-tint/40",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Message type"
          className="flex rounded-pill border border-line p-0.5"
        >
          {(["reply", "note"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={mode === item}
              onClick={() => setMode(item)}
              className={cn(
                type.caption,
                "rounded-pill px-3 py-1",
                mode === item
                  ? "bg-surface-3 text-fg"
                  : "text-fg-secondary hover:text-fg",
              )}
            >
              {item === "reply" ? "Reply to customer" : "Private note"}
            </button>
          ))}
        </div>
        <select
          aria-label="Insert a saved reply"
          className={cn(
            type.caption,
            "ms-auto h-8 rounded-button border border-line bg-surface-1 px-2 text-fg-secondary",
          )}
          value=""
          onChange={(event) => {
            const reply = replies.data?.find(
              (item) => item.id === event.target.value,
            );
            if (!reply) return;
            setText((current) =>
              current.trim()
                ? `${current.trimEnd()}\n\n${reply.body}`
                : reply.body,
            );
            box.current?.focus();
          }}
        >
          <option value="">Saved replies…</option>
          {replies.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <Link
          href="/admin/inbox/replies"
          className={cn(type.caption, "text-fg-tertiary hover:text-fg")}
        >
          Manage
        </Link>
      </div>
      <textarea
        ref={box}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={keys}
        rows={4}
        maxLength={2000}
        dir="auto"
        placeholder={
          mode === "reply"
            ? "Write a reply. The customer gets a push notification."
            : "Only staff see notes."
        }
        aria-label={mode === "reply" ? "Reply" : "Note"}
        className={cn(
          type.body,
          "w-full resize-y rounded-button border border-line bg-surface-1 px-4 py-3 text-fg outline-none placeholder:text-fg-tertiary focus:border-fg-tertiary",
        )}
      />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className={cn(type.caption, "me-auto text-fg-tertiary")}>
          Ctrl or ⌘ + Enter to send
        </span>
        {mode === "reply" ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy || !text.trim()}
            onClick={() => void send("resolved")}
          >
            Send and resolve
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={busy || !text.trim()}>
          {mode === "reply" ? "Send reply" : "Add note"}
        </Button>
      </div>
    </form>
  );
}

function CustomerPanel({
  chat,
  onOpen,
}: {
  chat: AdminConversation;
  onOpen: (id: string) => void;
}) {
  return (
    <aside className="flex flex-col gap-card-gap">
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex flex-col gap-1">
          <span className={type.bodyStrong}>{personName(chat.customer)}</span>
          {chat.customer.phone ? (
            <span className={cn(type.caption, "text-fg-secondary")}>
              {chat.customer.phone}
            </span>
          ) : null}
          {chat.customer.email ? (
            <span className={cn(type.caption, "break-all text-fg-secondary")}>
              {chat.customer.email}
            </span>
          ) : null}
          <span className={cn(type.caption, "text-fg-tertiary")}>
            {chat.customer.language.startsWith("ar") ? "Arabic" : "English"} ·
            joined{" "}
            {new Date(chat.customer.joined_at).toLocaleDateString("en-IN", {
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        {chat.customer.tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {chat.customer.tags.map((tag) => (
              <Pill key={tag}>{tag}</Pill>
            ))}
          </div>
        ) : null}
        <Link
          href={`/admin/customers/${encodeURIComponent(chat.user_id)}`}
          className={cn(type.calloutStrong, "text-accent hover:underline")}
        >
          Open customer profile →
        </Link>
      </Card>
      {chat.other_chats.length ? (
        <Card className="flex flex-col gap-2 p-5">
          <h3 className={cn(type.labelSm, "text-fg-tertiary")}>Other chats</h3>
          {chat.other_chats.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpen(item.id)}
              className="flex items-center justify-between gap-2 border-t border-line pt-2 text-start first:border-t-0 first:pt-0 hover:text-accent"
            >
              <span className={cn(type.caption, "flex min-w-0 flex-col")}>
                <span className="font-sans-semibold">#{item.number}</span>
                <span className="truncate text-fg-tertiary">
                  {item.esim?.label ?? "No plan"} · {when(item.last_message_at)}
                </span>
              </span>
              <Pill tone={conversationTone[item.status]}>
                {conversationLabel[item.status]}
              </Pill>
            </button>
          ))}
        </Card>
      ) : null}
      <Card className="flex flex-col gap-2 p-5">
        <h3 className={cn(type.labelSm, "text-fg-tertiary")}>eSIMs</h3>
        {chat.esims.length === 0 ? (
          <p className={cn(type.caption, "text-fg-secondary")}>None yet.</p>
        ) : (
          chat.esims.map((item) => (
            <div
              key={item.iccid}
              className="flex flex-col gap-0.5 border-t border-line pt-2 first:border-t-0 first:pt-0"
            >
              <span className="flex items-center justify-between gap-2">
                <span className={cn(type.caption, "truncate")}>
                  {item.label}
                </span>
                <Pill
                  tone={
                    item.status === "active"
                      ? "success"
                      : item.status === "not_started"
                        ? "accent"
                        : "neutral"
                  }
                >
                  {item.status.replace(/_/g, " ")}
                </Pill>
              </span>
              <span
                className={cn(type.caption, "text-fg-tertiary tabular-nums")}
              >
                {Math.round(item.data_used_mb)} of {item.data_total_mb} MB
                {item.expires_at ? ` · ends ${when(item.expires_at)}` : ""}
              </span>
            </div>
          ))
        )}
      </Card>
      <Card className="flex flex-col gap-2 p-5">
        <h3 className={cn(type.labelSm, "text-fg-tertiary")}>Recent orders</h3>
        {chat.orders.length === 0 ? (
          <p className={cn(type.caption, "text-fg-secondary")}>No orders.</p>
        ) : (
          chat.orders.map((item) => (
            <Link
              key={item.order_id}
              href={`/admin/orders/${item.order_id}`}
              className="flex items-center justify-between gap-2 border-t border-line pt-2 first:border-t-0 first:pt-0 hover:text-accent"
            >
              <span className={cn(type.caption, "flex flex-col")}>
                <span className="font-sans-semibold">{item.number}</span>
                <span className="text-fg-tertiary">
                  {money(item.total, item.currency)}
                </span>
              </span>
              <Pill tone={statusTone[item.status] ?? "neutral"}>
                {item.status.replace(/_/g, " ")}
              </Pill>
            </Link>
          ))
        )}
      </Card>
      {chat.last_rating ? (
        <Card className="flex flex-col gap-1 p-5">
          <h3 className={cn(type.labelSm, "text-fg-tertiary")}>Last rating</h3>
          <span className={type.bodyStrong}>
            {"★".repeat(chat.last_rating.score)}
            {"☆".repeat(5 - chat.last_rating.score)}
          </span>
          {chat.last_rating.comment ? (
            <span className={cn(type.caption, "text-fg-secondary")}>
              “{chat.last_rating.comment}”
            </span>
          ) : null}
        </Card>
      ) : null}
    </aside>
  );
}

function ConversationPane({
  chatId,
  staff,
  onChanged,
  onOpen,
}: {
  chatId: string;
  staff: AdminStaff[];
  onChanged: () => void;
  onOpen: (id: string) => void;
}) {
  const {
    data: chat,
    error,
    reload,
  } = usePolled<AdminConversation>(
    `/v1/admin/conversations/${encodeURIComponent(chatId)}`,
    POLL,
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const count = chat?.messages.length ?? 0;
  const loaded = chat !== null;

  // Opening marks it read, so refresh the list's unread badge.
  useEffect(() => {
    if (loaded) onChanged();
  }, [loaded, onChanged]);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [count, chatId]);

  async function update(body: {
    status?: ConversationStatus;
    assignee_id?: string | null;
    iccid?: string | null;
  }) {
    setBusy(true);
    setActionError(null);
    try {
      reload(
        await adminFetch<AdminConversation>(
          `/v1/admin/conversations/${encodeURIComponent(chatId)}`,
          { method: "PATCH", body },
        ),
      );
      onChanged();
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : "That didn’t work",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!chat)
    return error ? (
      <ErrorNote>{error}</ErrorNote>
    ) : (
      <Skeleton className="h-[640px]" />
    );

  return (
    <div className="grid min-w-0 gap-card-gap xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="flex min-h-[640px] min-w-0 flex-col">
        <div className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <div className="me-auto flex min-w-0 flex-col gap-1">
            <h2 className={cn(type.title, "truncate")}>
              {personName(chat.customer)}{" "}
              <span className="text-fg-tertiary tabular-nums">
                #{chat.number}
              </span>
            </h2>
            <span className="flex items-center gap-2">
              <Pill tone={conversationTone[chat.status]}>
                {conversationLabel[chat.status]}
              </Pill>
              {chat.rating_requested ? (
                <span className={cn(type.caption, "text-fg-tertiary")}>
                  Rating asked
                </span>
              ) : null}
            </span>
          </div>
          <>
            <Select
              label="About plan"
              className="w-48"
              value={chat.esim?.iccid ?? ""}
              disabled={busy}
              onChange={(event) =>
                void update({ iccid: event.target.value || null })
              }
            >
              <option value="">No plan</option>
              {chat.esim &&
              !chat.esims.some((item) => item.iccid === chat.esim?.iccid) ? (
                <option value={chat.esim.iccid}>{chat.esim.label}</option>
              ) : null}
              {chat.esims.map((item) => (
                <option key={item.iccid} value={item.iccid}>
                  {item.label} · …{item.iccid.slice(-4)}
                </option>
              ))}
            </Select>
            <Select
              label="Assigned to"
              className="w-48"
              value={chat.assignee?.user_id ?? ""}
              disabled={busy}
              onChange={(event) =>
                void update({ assignee_id: event.target.value || null })
              }
            >
              <option value="">Unassigned</option>
              {staff.map((item) => (
                <option key={item.user_id} value={item.user_id}>
                  {item.name}
                </option>
              ))}
            </Select>
            {chat.status === "resolved" ? (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void update({ status: "open" })}
              >
                Reopen
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void update({ status: "resolved" })}
              >
                Resolve
              </Button>
            )}
          </>
        </div>
        {actionError ? (
          <div className="p-4 pb-0">
            <ErrorNote>{actionError}</ErrorNote>
          </div>
        ) : null}
        <div
          className="flex max-h-[560px] min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
          aria-live="polite"
        >
          {chat.messages.length === 0 ? (
            <p className={cn(type.callout, "m-auto text-fg-tertiary")}>
              No messages yet. Start the conversation below.
            </p>
          ) : (
            chat.messages.map((message) => {
              const mine = message.from === "agent";
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex max-w-[78%] flex-col gap-1",
                    mine ? "self-end items-end" : "self-start items-start",
                  )}
                >
                  <div
                    dir="auto"
                    className={cn(
                      type.callout,
                      "whitespace-pre-wrap break-words rounded-card px-4 py-2.5",
                      message.internal
                        ? "border border-dashed border-warning/60 bg-warning-tint text-fg"
                        : mine
                          ? "bg-fg text-fg-inverse"
                          : "border border-line bg-surface-2",
                    )}
                  >
                    {message.text}
                  </div>
                  <span className={cn(type.caption, "text-fg-tertiary")}>
                    {message.internal ? "Private note · " : ""}
                    {mine
                      ? (message.staff?.name ?? "Staff")
                      : personName(chat.customer)}{" "}
                    · {when(message.at)}
                  </span>
                </div>
              );
            })
          )}
          <div ref={end} />
        </div>
        <Composer
          chatId={chatId}
          onSent={(next) => {
            reload(next);
            onChanged();
          }}
        />
      </Card>
      <CustomerPanel chat={chat} onOpen={onOpen} />
    </div>
  );
}

export function InboxView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("c");
  const [status, setStatus] = useState<ConversationStatus | "all">("open");
  const [assignee, setAssignee] = useState<"any" | "me" | "unassigned">("any");
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const query = new URLSearchParams({
    status,
    assignee,
    ...(q ? { q } : {}),
  }).toString();
  const list = usePolled<AdminConversationRow[]>(
    `/v1/admin/conversations?${query}`,
    POLL,
  );
  const staff = usePolled<AdminStaff[]>("/v1/admin/staff");

  function select(id: string) {
    const next = new URLSearchParams(params.toString());
    next.set("c", id);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  function search(event: FormEvent) {
    event.preventDefault();
    setQ(draft.trim());
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className={type.displayLg}>inbox</h1>
        <Link
          href="/admin/inbox/replies"
          className={cn(type.callout, "text-fg-secondary hover:text-fg")}
        >
          Saved replies
        </Link>
      </div>
      <Stats />
      <div className="grid gap-card-gap lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <div
            role="tablist"
            aria-label="Conversation status"
            className="flex rounded-pill border border-line p-0.5"
          >
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={status === tab.value}
                onClick={() => setStatus(tab.value)}
                className={cn(
                  type.caption,
                  "flex-1 rounded-pill px-2 py-1.5",
                  status === tab.value
                    ? "bg-surface-3 text-fg"
                    : "text-fg-secondary hover:text-fg",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              aria-label="Assigned to"
              value={assignee}
              onChange={(event) =>
                setAssignee(event.target.value as typeof assignee)
              }
              className={cn(
                type.callout,
                "h-button-compact rounded-button border border-line bg-surface-1 px-3 text-fg",
              )}
            >
              <option value="any">Anyone</option>
              <option value="me">Mine</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <form onSubmit={search} className="flex-1">
              <input
                aria-label="Search conversations"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => setQ(draft.trim())}
                placeholder="Search name, phone or text"
                className={cn(
                  type.callout,
                  "h-button-compact w-full rounded-button border border-line bg-surface-1 px-3 text-fg outline-none placeholder:text-fg-tertiary focus:border-fg-tertiary",
                )}
              />
            </form>
          </div>
          {list.error ? (
            <ErrorNote>{list.error}</ErrorNote>
          ) : list.data === null ? (
            <Skeleton />
          ) : (
            <ConversationList
              rows={list.data}
              selected={selected}
              onSelect={select}
            />
          )}
        </div>
        {selected ? (
          <ConversationPane
            key={selected}
            chatId={selected}
            staff={staff.data ?? []}
            onChanged={list.reload}
            onOpen={select}
          />
        ) : (
          <Card className="flex min-h-[400px] items-center justify-center p-section">
            <p className={cn(type.callout, "text-fg-tertiary")}>
              Pick a conversation to read and reply.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}

export function SavedRepliesView() {
  const role = useStaffRole();
  const { data, error, reload } = usePolled<SavedReply[]>(
    "/v1/admin/saved-replies",
  );
  const [editing, setEditing] = useState<SavedReply | "new" | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function edit(item: SavedReply | "new") {
    setEditing(item);
    setTitle(item === "new" ? "" : item.title);
    setBody(item === "new" ? "" : item.body);
    setProblem(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setProblem(null);
    try {
      if (editing === "new")
        await adminFetch("/v1/admin/saved-replies", {
          method: "POST",
          body: { title, body },
        });
      else
        await adminFetch(`/v1/admin/saved-replies/${editing.id}`, {
          method: "PATCH",
          body: { title, body },
        });
      setEditing(null);
      reload();
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "Couldn’t save");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: SavedReply) {
    if (!window.confirm(`Delete the saved reply “${item.title}”?`)) return;
    try {
      await adminFetch(`/v1/admin/saved-replies/${item.id}`, {
        method: "DELETE",
      });
      reload();
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : "Couldn’t delete");
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/inbox"
          className={cn(type.callout, "text-fg-secondary hover:text-fg")}
        >
          ← Inbox
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className={type.displayLg}>saved replies</h1>
          <Button onClick={() => edit("new")}>New reply</Button>
        </div>
        <p className={cn(type.callout, "max-w-2xl text-fg-secondary")}>
          Answers you send often. Pick one from the reply box in the inbox to
          insert it, then edit before sending.
        </p>
      </div>
      {problem && !editing ? <ErrorNote>{problem}</ErrorNote> : null}
      {editing ? (
        <Card className="p-section">
          <form onSubmit={save} className="flex flex-col gap-4">
            <Field
              label="Title"
              name="title"
              value={title}
              maxLength={60}
              onChange={(event) => setTitle(event.target.value)}
            />
            <label className="flex flex-col gap-2">
              <span className={cn(type.label, "text-fg-tertiary")}>
                Message
              </span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={6}
                maxLength={2000}
                dir="auto"
                className={cn(
                  type.body,
                  "rounded-button border border-line bg-surface-1 px-4 py-3 text-fg outline-none focus:border-fg-tertiary",
                )}
              />
            </label>
            {problem ? <ErrorNote>{problem}</ErrorNote> : null}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={busy || !title.trim() || !body.trim()}
              >
                Save
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
      {error ? (
        <ErrorNote>{error}</ErrorNote>
      ) : data === null ? (
        <Skeleton />
      ) : data.length === 0 ? (
        <Empty>No saved replies yet.</Empty>
      ) : (
        <div className="grid gap-card-gap md:grid-cols-2">
          {data.map((item) => (
            <Card key={item.id} className="flex flex-col gap-3 p-section">
              <h2 className={type.bodyStrong}>{item.title}</h2>
              <p
                className={cn(
                  type.callout,
                  "whitespace-pre-wrap text-fg-secondary",
                )}
                dir="auto"
              >
                {item.body}
              </p>
              <div className="mt-auto flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => edit(item)}
                >
                  Edit
                </Button>
                {role === "admin" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void remove(item)}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
