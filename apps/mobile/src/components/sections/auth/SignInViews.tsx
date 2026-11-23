import { VelaLockup } from '@vela/brand/native';
import { pad2 } from '@vela/utils';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import { Banner, Button, Chip, IconButton, Input, OtpInput, Text } from '@/components/ui';
import { useNow } from '@/hooks/useNow';

export type DialCode = '+91' | '+971' | '+966';
export const dialCodes: readonly DialCode[] = ['+91', '+971', '+966'];

type ChooseViewProps = {
  busy: boolean;
  error: string | null;
  onApple: () => void;
  onGoogle: () => void;
  onPhone: () => void;
};

export function ChooseView({ busy, error, onApple, onGoogle, onPhone }: ChooseViewProps) {
  const { t } = useTranslation();
  return (
    <View className="flex-1 justify-between">
      <View className="flex-1 justify-center gap-6">
        <VelaLockup size={40} clearSpace={false} className="text-fg" />
        <View className="gap-3">
          <Text variant="display-xl" accessibilityRole="header">
            {t('signIn.title')}
          </Text>
          <Text tone="secondary">{t('signIn.body')}</Text>
        </View>
      </View>
      <View className="gap-3">
        {error ? <Banner tone="danger" title={error} /> : null}
        {Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={14}
            onPress={onApple}
            className="h-button w-full"
          />
        ) : null}
        <Button label={t('signIn.google')} variant="secondary" fullWidth loading={busy} onPress={onGoogle} />
        <Button label={t('signIn.phone')} variant="ghost" fullWidth icon="chat" onPress={onPhone} />
        <Text variant="caption" tone="tertiary" align="center" className="mt-2">
          {t('signIn.terms')}
        </Text>
      </View>
    </View>
  );
}

type PhoneViewProps = {
  dialCode: DialCode;
  number: string;
  busy: boolean;
  error: string | null;
  onDialCode: (code: DialCode) => void;
  onNumber: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
};

export function PhoneView({ dialCode, number, busy, error, onDialCode, onNumber, onSubmit, onBack }: PhoneViewProps) {
  const { t } = useTranslation();
  const valid = number.replace(/\D/g, '').length >= 8;
  return (
    <View className="flex-1 justify-between">
      <View className="gap-6">
        <IconButton icon="arrowBack" accessibilityLabel={t('common.back')} onPress={onBack} />
        <View className="gap-3">
          <Text variant="display-xl" accessibilityRole="header">
            {t('signIn.phoneTitle')}
          </Text>
          <Text tone="secondary">{t('signIn.phoneBody')}</Text>
        </View>
        <View className="flex-row gap-2">
          {dialCodes.map((code) => (
            <Chip key={code} label={code} selected={dialCode === code} onPress={() => onDialCode(code)} />
          ))}
        </View>
        <Input
          label={t('signIn.phoneLabel')}
          placeholder={t('signIn.phonePlaceholder')}
          value={number}
          onChangeText={onNumber}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          autoFocus
          returnKeyType="send"
          onSubmitEditing={() => valid && onSubmit()}
        />
      </View>
      <View className="gap-3">
        {error ? <Banner tone="danger" title={error} /> : null}
        <Button label={t('signIn.sendCode')} fullWidth disabled={!valid} loading={busy} onPress={onSubmit} />
      </View>
    </View>
  );
}

type CodeViewProps = {
  phone: string;
  code: string;
  error: boolean;
  busy: boolean;
  onCode: (value: string) => void;
  onComplete: (value: string) => void;
  onResend: () => void;
  onBack: () => void;
};

const RESEND_SECONDS = 30;

export function CodeView({ phone, code, error, busy, onCode, onComplete, onResend, onBack }: CodeViewProps) {
  const { t } = useTranslation();
  const now = useNow();
  const [sentAt, setSentAt] = useState(() => Date.now());
  const remaining = Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000));
  return (
    <View className="flex-1 gap-6">
      <IconButton icon="arrowBack" accessibilityLabel={t('signIn.changeNumber')} onPress={onBack} />
      <View className="gap-3">
        <Text variant="display-xl" accessibilityRole="header">
          {t('signIn.codeTitle')}
        </Text>
        <Text tone="secondary">{t('signIn.codeBody', { phone })}</Text>
      </View>
      <OtpInput
        accessibilityLabel={t('signIn.codeLabel')}
        value={code}
        error={error}
        disabled={busy}
        autoFocus
        onChange={onCode}
        onComplete={onComplete}
      />
      {error ? (
        <Text variant="callout" tone="danger" accessibilityLiveRegion="polite">
          {t('signIn.wrongCode')}
        </Text>
      ) : null}
      {remaining > 0 ? (
        <Text variant="callout" tone="tertiary">
          {t('signIn.resendIn', { time: `0:${pad2(remaining)}` })}
        </Text>
      ) : (
        <Button
          label={t('signIn.resend')}
          variant="ghost"
          size="sm"
          onPress={() => {
            setSentAt(Date.now());
            onResend();
          }}
        />
      )}
      {__DEV__ && !process.env.EXPO_PUBLIC_API_URL ? (
        <Text variant="caption" tone="quaternary">
          {t('signIn.demoHint')}
        </Text>
      ) : null}
    </View>
  );
}
