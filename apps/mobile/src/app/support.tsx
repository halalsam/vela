import type { SupportChatSummary } from '@vela/api';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageBubble, RatingCard, TypingBubble, type ChatMessage } from '@/components/sections/support/SupportSections';
import { ErrorState, OfflineBanner, RowsSkeleton } from '@/components/sections/states/StateViews';
import { Button, Chip, IconButton, Input, MenuPicker, Text } from '@/components/ui';
import { usingLiveCatalog } from '@/lib/api';
import { useOnline } from '@/lib/useOnline';
import { useEsims, useRateSupportChat, useSendSupportChatMessage, useStartSupportChat, useSupportChat, useSupportChats } from '@/queries';

const REPLY_DELAY = 1400;
const replies = ['support.reply1', 'support.reply2', 'support.reply3'] as const;
const NO_PLAN = 'none';

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ chat?: string }>();
  const online = useOnline();
  const scroll = useRef<ScrollViewInstance>(null);

  const chats = useSupportChats();
  const esims = useEsims();
  /** The chat on screen: an id, `new` for the new-chat form, or null for the most recent one. */
  const [selected, setSelected] = useState<string | null>(params.chat ?? null);
  const list = chats.data ?? [];
  const composing = selected === 'new' || (chats.isSuccess && list.length === 0);
  const activeId = composing ? null : (selected ?? list[0]?.id ?? null);
  const chat = useSupportChat(activeId);

  const start = useStartSupportChat();
  const send = useSendSupportChatMessage();
  const rate = useRateSupportChat();
  const [plan, setPlan] = useState(NO_PLAN);
  const [draft, setDraft] = useState('');
  const [ratingHidden, setRatingHidden] = useState<string | null>(null);
  const [rated, setRated] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [agentReplies, setAgentReplies] = useState<ChatMessage[]>([]);

  // A push can open a specific chat while the screen is already open.
  const [pushed, setPushed] = useState(params.chat);
  if (params.chat !== pushed) {
    setPushed(params.chat);
    if (params.chat) setSelected(params.chat);
  }

  // Demo only: a canned agent reply so the screen feels alive without a server.
  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => {
      setTyping(false);
      setAgentReplies((items) => [...items, { id: `a${items.length}`, from: 'agent', text: t('support.agentReply'), install_step: null }]);
    }, REPLY_DELAY);
    return () => clearTimeout(timer);
  }, [typing, t]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !online) return;
    const demoReply = () => !usingLiveCatalog && setTyping(true);
    if (composing) {
      start.mutate(
        { text: trimmed, iccid: plan === NO_PLAN ? null : plan },
        {
          onSuccess: (created) => {
            setDraft('');
            setPlan(NO_PLAN);
            setAgentReplies([]);
            setSelected(created.chat.id);
            demoReply();
          },
        },
      );
      return;
    }
    if (!activeId) return;
    send.mutate(
      { id: activeId, text: trimmed },
      {
        onSuccess: () => {
          setDraft('');
          demoReply();
        },
      },
    );
  }

  function openChat(id: string) {
    setAgentReplies([]);
    setTyping(false);
    setSelected(id);
  }

  const summary = chat.data?.chat ?? null;
  const messages: ChatMessage[] = [...(chat.data?.messages ?? []), ...agentReplies];
  const statusText = (item: SupportChatSummary) =>
    ({ open: t('support.statusOpen'), pending: t('support.statusPending'), resolved: t('support.statusResolved') })[item.status];
  const chatLabel = (item: SupportChatSummary) => [t('support.chatNumber', { number: item.number }), item.esim?.label, statusText(item)].filter(Boolean).join(' · ');
  const planOptions = [{ value: NO_PLAN, label: t('support.noPlan') }, ...(esims.data ?? []).map((item) => ({ value: item.iccid, label: item.label }))];
  const busy = start.isPending || send.isPending;
  const loading = chats.isPending || (!composing && chat.isPending);
  const failed = chats.isError || (!composing && chat.isError);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100} className="flex-1 bg-canvas">
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View className="items-center">
              <Text weight="semibold">{t('support.title')}</Text>
              <View className="flex-row items-center gap-1.5">
                <View className={online ? 'h-1.5 w-1.5 rounded-pill bg-success' : 'h-1.5 w-1.5 rounded-pill bg-fg-quaternary'} />
                <Text variant="caption" tone="tertiary">
                  {online ? t('support.online') : t('states.offlineTitle')}
                </Text>
              </View>
            </View>
          ),
          headerRight: () =>
            composing ? null : (
              <Button
                label={t('support.newChat')}
                variant="ghost"
                size="sm"
                disabled={!online}
                onPress={() => {
                  setDraft('');
                  setSelected('new');
                }}
              />
            ),
        }}
      />
      {list.length > 1 || (composing && list.length > 0) || summary?.esim ? (
        <View className="flex-row flex-wrap items-center gap-2 border-b border-line px-gutter py-2">
          {list.length > 0 && !composing ? (
            <MenuPicker<string> value={activeId ?? ''} options={list.map((item) => ({ value: item.id, label: chatLabel(item) }))} onChange={openChat} accessibilityLabel={t('support.yourChats')} />
          ) : null}
          {composing && list.length > 0 ? <Button label={t('support.cancel')} variant="ghost" size="sm" onPress={() => setSelected(null)} /> : null}
          {summary?.esim && !composing ? (
            <View className="rounded-chip bg-accent/15 px-2 py-1">
              <Text variant="caption" tone="accent">
                {t('support.about', { plan: summary.esim.label })}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <ScrollView
        ref={scroll}
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerClassName="grow justify-end gap-3 px-gutter pb-4"
      >
        <OfflineBanner />
        {failed ? (
          <ErrorState
            onRetry={() => {
              void chats.refetch();
              if (activeId) void chat.refetch();
            }}
          />
        ) : composing ? (
          <View className="gap-4 self-stretch rounded-card-lg border border-line bg-surface-1 p-4">
            <Text variant="callout" tone="secondary">
              {t('support.newChatIntro')}
            </Text>
            {planOptions.length > 1 ? (
              <View className="flex-row items-center justify-between gap-3">
                <Text variant="callout" weight="semibold">
                  {t('support.plan')}
                </Text>
                <MenuPicker<string> value={plan} options={planOptions} onChange={setPlan} accessibilityLabel={t('support.plan')} />
              </View>
            ) : null}
          </View>
        ) : loading ? (
          <RowsSkeleton rows={3} />
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
        {typing ? <TypingBubble /> : null}
        {summary?.rating_asked && ratingHidden !== summary.id ? (
          <RatingCard
            busy={rate.isPending}
            onDismiss={() => setRatingHidden(summary.id)}
            onRate={(score) => rate.mutate({ id: summary.id, score }, { onSuccess: () => setRated(summary.id) })}
          />
        ) : null}
        {rated && rated === summary?.id ? (
          <Text variant="caption" tone="tertiary" className="self-center" accessibilityLiveRegion="polite">
            {t('support.rateThanks')}
          </Text>
        ) : null}
      </ScrollView>
      <View className="gap-3 border-t border-line px-gutter pt-3" style={{ paddingBottom: insets.bottom + 8 }}>
        {composing ? null : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {replies.map((key) => (
              <Chip key={key} label={t(key)} disabled={!online || busy} onPress={() => submit(t(key))} />
            ))}
          </ScrollView>
        )}
        <View className="flex-row items-center gap-2">
          <IconButton icon="plus" accessibilityLabel={t('support.attach')} onPress={() => undefined} disabled={!online} />
          <Input
            className="flex-1"
            variant="search"
            leadingIcon="chat"
            placeholder={t('support.placeholder')}
            value={draft}
            onChangeText={setDraft}
            editable={online && !busy}
            returnKeyType="send"
            onSubmitEditing={() => submit(draft)}
          />
          <IconButton
            icon="arrowUpForward"
            variant="primary"
            accessibilityLabel={composing ? t('support.start') : t('support.send')}
            disabled={!draft.trim() || !online || busy}
            onPress={() => submit(draft)}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
