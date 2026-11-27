import type { SupportChatSummary, SupportMessage } from '@vela/api';
import type { ConversationRow, MessageRow, RatingRow, SavedReplyRow } from '../models/support.model';

const GREETING = {
  en: 'Hi, this is vela support. Ask us anything about installing or using your eSIM.',
  ar: 'مرحبًا، هنا دعم vela. اسألنا عن أي شيء يخص تثبيت شريحتك أو استخدامها.',
};

type LastMessage = { text: string; sender: MessageRow['sender']; internal: boolean; at: Date };
type Labels = Map<string, string>;
type Names = Map<string, string>;

const from = (sender: MessageRow['sender']) => (sender === 'agent' ? ('agent' as const) : ('user' as const));

/** The plan a chat is about, labelled when we know the eSIM. */
export const esimRef = (iccid: string | null, labels: Labels) => (iccid ? { iccid, label: labels.get(iccid) ?? iccid } : null);
const staffRef = (id: string | null, names: Names) => (id ? { user_id: id, name: names.get(id) ?? 'Staff' } : null);

/* Customer side (the app and website). */

/** The welcome message shown first in every chat. */
export function greetingMessage(language: string, at: Date): SupportMessage {
  return { id: 'welcome', from: 'agent', text: language.startsWith('ar') ? GREETING.ar : GREETING.en, sent_at: at.toISOString(), install_step: null };
}

export function customerMessage(row: MessageRow): SupportMessage {
  return { id: row.id, from: from(row.sender), text: row.text, sent_at: row.createdAt.toISOString(), install_step: null };
}

export function chatSummary(row: ConversationRow, last: LastMessage | undefined, labels: Labels): SupportChatSummary {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    esim: esimRef(row.iccid, labels),
    last_message: last ? { text: last.text, from: from(last.sender), sent_at: last.at.toISOString() } : null,
    updated_at: row.lastMessageAt.toISOString(),
    rating_asked: Boolean(row.ratingRequestedAt),
  };
}

/* Staff side (the admin inbox). */

export function inboxItem(
  row: { conversation: ConversationRow; name: string | null; phone: string | null; email: string | null; language: string | null },
  context: { last: LastMessage | undefined; unread: number; names: Names; labels: Labels },
) {
  const { conversation } = row;
  const message = context.last;
  return {
    id: conversation.id,
    number: conversation.number,
    user_id: conversation.userId,
    customer: { name: row.name, phone: row.phone, email: row.email, language: row.language ?? 'en' },
    status: conversation.status,
    esim: esimRef(conversation.iccid, context.labels),
    assignee: staffRef(conversation.assigneeId, context.names),
    last_message: message ? { text: message.text, from: from(message.sender), internal: message.internal, at: message.at.toISOString() } : null,
    unread: context.unread,
    waiting_since: conversation.status === 'open' ? (conversation.lastCustomerAt?.toISOString() ?? null) : null,
    last_message_at: conversation.lastMessageAt.toISOString(),
  };
}

export function staffMessage(item: MessageRow, names: Names) {
  return {
    id: item.id,
    from: from(item.sender),
    text: item.text,
    internal: item.internal,
    staff: staffRef(item.staffId, names),
    at: item.createdAt.toISOString(),
  };
}

export function otherChat(item: ConversationRow, labels: Labels) {
  return { id: item.id, number: item.number, status: item.status, esim: esimRef(item.iccid, labels), last_message_at: item.lastMessageAt.toISOString() };
}

export function conversationHeader(current: ConversationRow, rating: RatingRow | null, names: Names, labels: Labels) {
  return {
    id: current.id,
    number: current.number,
    user_id: current.userId,
    status: current.status,
    esim: esimRef(current.iccid, labels),
    assignee: staffRef(current.assigneeId, names),
    resolved_at: current.resolvedAt?.toISOString() ?? null,
    rating_requested: Boolean(current.ratingRequestedAt),
    last_rating: rating ? { score: rating.score, comment: rating.comment, at: rating.createdAt.toISOString() } : null,
  };
}

export function savedReplyView(row: SavedReplyRow) {
  return { id: row.id, title: row.title, body: row.body, updated_at: row.updatedAt.toISOString() };
}

export function staffMember(row: { id: string; name: string | null; email: string | null; role: string }) {
  return { user_id: row.id, name: row.name ?? row.email ?? 'Staff', role: row.role };
}

export function chatEsim(item: { iccid: string; label: string; status: string; dataUsedMb: number; dataTotalMb: number; expiresAt: Date | null }) {
  return {
    iccid: item.iccid,
    label: item.label,
    status: item.status,
    data_used_mb: item.dataUsedMb,
    data_total_mb: item.dataTotalMb,
    expires_at: item.expiresAt?.toISOString() ?? null,
  };
}
