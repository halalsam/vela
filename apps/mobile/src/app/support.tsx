import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { MessageBubble, RatingCard, TypingBubble, type ChatMessage } from '@/components/sections/support/SupportSections';
import { ErrorState, OfflineBanner, RowsSkeleton } from '@/components/sections/states/StateViews';
import { Chip, IconButton, Input, Text } from '@/components/ui';
import { usingLiveCatalog } from '@/lib/api';
import { useOnline } from '@/lib/useOnline';
import { useRateSupport, useSendSupportMessage, useSupportRating, useSupportThread } from '@/queries';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const REPLY_DELAY = 1400;
const replies = ['support.reply1', 'support.reply2', 'support.reply3'] as const;

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const thread = useSupportThread();
  const send = useSendSupportMessage();
  const rating = useSupportRating();
  const rate = useRateSupport();
  const [ratingHidden, setRatingHidden] = useState(false);
  const [rated, setRated] = useState(false);
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
    send.mutate(trimmed, { onSuccess: () => !usingLiveCatalog && setTyping(true) });
  }

  const messages: ChatMessage[] = [...(thread.data ?? []), ...agentReplies];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
      className="flex-1 bg-canvas"
    >
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
        {rating.data?.asked && !ratingHidden ? (
          <RatingCard
            busy={rate.isPending}
            onDismiss={() => setRatingHidden(true)}
            onRate={(score) => rate.mutate({ score }, { onSuccess: () => setRated(true) })}
          />
        ) : null}
        {rated ? (
          <Text variant="caption" tone="tertiary" className="self-center" accessibilityLiveRegion="polite">
            {t('support.rateThanks')}
          </Text>
        ) : null}
      </ScrollView>
      <View className="gap-3 border-t border-line px-gutter pt-3" style={{ paddingBottom: insets.bottom + 8 }}>
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
          <IconButton
            icon="arrowUpForward"
            variant="primary"
            accessibilityLabel={t('support.send')}
            disabled={!draft.trim() || !online}
            onPress={() => submit(draft)}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
