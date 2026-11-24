import { VelaLockup } from '@vela/brand/native';
import { colors, radii } from '@vela/tokens';
import { pad2 } from '@vela/utils';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { ActivityIndicator, Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { FlagMarquee } from '@/components/esim';
import { Banner, Button, Chip, GoogleLogo, Icon, IconButton, Input, OtpInput, Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { useNow } from '@/hooks/useNow';
import { continentAsset } from '@/lib/geoAssets';

export type DialCode = '+91' | '+971' | '+966';
export const dialCodes: readonly DialCode[] = ['+91', '+971', '+966'];

type ChooseViewProps = {
  busy: boolean;
  error: string | null;
  onApple: () => void;
  onGoogle: () => void;
  onPhone: () => void;
};

const FLAG_ROWS = [
  ['AE', 'JP', 'TH', 'GB', 'TR', 'SG', 'FR', 'ID', 'IT', 'SA'],
  ['US', 'ES', 'MY', 'CH', 'QA', 'VN', 'DE', 'GR', 'KR', 'AU'],
] as const;

type AuthButtonProps = {
  label: string;
  mark: ReactNode;
  tone: 'light' | 'dark' | 'ghost';
  busy?: boolean;
  onPress: () => void;
};

/**
 * Sign-in buttons share one layout: the mark sits in the same 20pt box at the same
 * inset on every row and the label stays centred, so the three logos line up
 * whatever the label length. The native Apple button drew its own logo at its own
 * size, which never matched; Apple's guidelines allow a custom button with the
 * Apple logo, and the sign-in itself still uses the native Apple flow.
 */
function AuthButton({ label, mark, tone, busy = false, onPress }: AuthButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      style={{ height: 50, borderRadius: radii.button }}
      className={cn(
        'w-full flex-row items-center justify-center active:opacity-80',
        tone === 'light' ? 'bg-fg' : tone === 'dark' ? 'border border-line bg-surface-2' : 'border border-line-strong',
      )}
    >
      <View className="absolute items-center justify-center" style={{ start: 18, width: 20, height: 20 }}>
        {mark}
      </View>
      {busy ? (
        <ActivityIndicator color={tone === 'light' ? colors.fg.inverse : colors.fg.DEFAULT} />
      ) : (
        <Text weight="semibold" tone={tone === 'light' ? 'inverse' : 'primary'} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function ChooseView({ busy, error, onApple, onGoogle, onPhone }: ChooseViewProps) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  return (
    <View className="flex-1 justify-between">
      {/* Continent silhouette bleeds off the trailing edge behind the flag rows. */}
      <Image
        source={continentAsset('asia')}
        contentFit="contain"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          top: 24,
          end: -width * 0.35,
          width: width * 1.25,
          height: width * 0.9,
          opacity: 0.05,
        }}
      />
      <View className="-mx-section flex-1 justify-center gap-3">
        <FlagMarquee codes={FLAG_ROWS[0]} size="xl" />
        <FlagMarquee codes={FLAG_ROWS[1]} size="xl" reverse speed={14} />
      </View>
      <View className="gap-8">
        <View className="gap-4">
          <VelaLockup size={28} clearSpace={false} className="text-fg" />
          <View className="gap-2">
            <Text variant="display-xl" accessibilityRole="header">
              {t('signIn.title')}
            </Text>
            <Text tone="secondary" className="max-w-[320px]">
              {t('signIn.body')}
            </Text>
          </View>
        </View>
        <View className="gap-3">
          {error ? <Banner tone="danger" title={error} /> : null}
          {Platform.OS === 'ios' ? (
            <AuthButton
              label={t('signIn.apple')}
              tone="light"
              mark={<Icon name="apple" size={19} tone="inverse" weight="semibold" />}
              onPress={onApple}
            />
          ) : null}
          <AuthButton label={t('signIn.google')} tone="dark" mark={<GoogleLogo size={18} />} busy={busy} onPress={onGoogle} />
          <AuthButton label={t('signIn.phone')} tone="ghost" mark={<Icon name="chat" size={18} />} onPress={onPhone} />
          <Text variant="caption" tone="tertiary" align="center" className="mt-1">
            {t('signIn.terms')}
          </Text>
        </View>
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
