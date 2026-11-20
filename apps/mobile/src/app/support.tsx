import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { MessageBubble, TypingBubble, type ChatMessage } from '@/components/sections/support/SupportSections';
import { ErrorState, OfflineBanner, RowsSkeleton } from '@/components/sections/states/StateViews';
import { Chip, IconButton, Input, Text } from '@/components/ui';
import { useOnline } from '@/lib/useOnline';
import { useSendSupportMessage, useSupportThread } from '@/queries';

const REPLY_DELAY = 1400;
const replies = ['support.reply1', 'support.reply2', 'support.reply3'] as const;

export default function SupportScreen() {
  const { t } = useTranslation();
  const thread = useSupportThread();
  const send = useSendSupportMessage();
  const online = useOnline();
  const scroll = useRef<ScrollViewInstance>(null);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [agentReplies, setAgentReplies] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!typing) return;
    const timer = setTimeout(() => {
      setTyping(false);
      setAgentReplies((list) => [...list, { id: `a${list.length}`, from: 'agent', text: t('support.agentReply'), install_step: null }]);
    }, REPLY_DELAY);
    return () => clearTimeout(timer);
  }, [typing, t]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !online) return;
    setDraft('');
    send.mutate(trimmed, { onSuccess: () => setTyping(true) });
  }

  const messages: ChatMessage[] = [...(thread.data ?? []), ...agentReplies];

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
        }}
      />
      <ScrollView
        ref={scroll}
        className="flex-1"
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerClassName="grow justify-end gap-3 px-gutter pb-4"
      >
        <OfflineBanner />
        {thread.isPending ? (
          <RowsSkeleton rows={3} />
        ) : thread.isError ? (
          <ErrorState onRetry={() => void thread.refetch()} />
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
        {typing ? <TypingBubble /> : null}
      </ScrollView>
      <View className="gap-3 border-t border-line px-gutter pb-safe-offset-2 pt-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {replies.map((key) => (
            <Chip key={key} label={t(key)} disabled={!online} onPress={() => submit(t(key))} />
          ))}
        </ScrollView>
        <View className="flex-row items-center gap-2">
          <IconButton icon="plus" accessibilityLabel={t('support.attach')} onPress={() => undefined} disabled={!online} />
          <Input
            className="flex-1"
            variant="search"
            leadingIcon="chat"
            placeholder={t('support.placeholder')}
            value={draft}
            onChangeText={setDraft}
            editable={online}
            returnKeyType="send"
            onSubmitEditing={() => submit(draft)}
          />
          <IconButton icon="arrowUpForward" variant="primary" accessibilityLabel={t('support.send')} disabled={!draft.trim() || !online} onPress={() => submit(draft)} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
