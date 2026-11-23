import { SELLING_CURRENCIES, type Currency } from '@vela/api';
import { queryClient } from '@/lib/queryClient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';
import { Card, ListGroup, ListRow, MenuPicker, Skeleton, Switch, Text, toast } from '@/components/ui';
import { directionNeedsRestart } from '@/i18n/useLanguageSync';
import { useProfile } from '@/queries';
import { devScenarios, useDevStore, type DevScenario } from '@/stores/dev';
import { deleteAccount } from '@/lib/auth';
import { signOutDevice } from '@/lib/push';
import { useSession, type LanguagePreference } from '@/stores/session';
import * as WebBrowser from 'expo-web-browser';
import i18n from '@/i18n';

export function AccountCard() {
  const { t } = useTranslation();
  const { data, isPending } = useProfile();
  const provider = useSession((state) => state.provider);
  if (isPending) return <Skeleton className="h-24 w-full rounded-card" />;
  if (!data) return null;
  const initials = data.name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2);
  const providerName = provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : t('signIn.phoneLabel');
  return (
    <Card padding="lg" className="flex-row items-center gap-4">
      <View className="h-14 w-14 items-center justify-center rounded-pill bg-fg">
        <Text variant="title" tone="inverse">
          {initials}
        </Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="title" numberOfLines={1}>
          {data.name}
        </Text>
        <Text variant="callout" tone="secondary" numberOfLines={1}>
          {data.email ?? data.phone}
        </Text>
        <Text variant="caption" tone="tertiary">
          {t('profile.signedInWith', { provider: providerName })}
        </Text>
      </View>
    </Card>
  );
}

const currencies: readonly Currency[] = SELLING_CURRENCIES;

export function PreferencesGroup() {
  const { t } = useTranslation();
  const language = useSession((state) => state.language);
  const currency = useSession((state) => state.currency);
  const notifications = useSession((state) => state.notifications);
  const faceId = useSession((state) => state.faceIdForPurchases);
  const session = useSession.getState();
  return (
    <ListGroup
      header={t('profile.preferences')}
      footer={directionNeedsRestart(language) ? t('profile.restartNote') : undefined}
    >
      <ListRow
        leadingIcon="language"
        title={t('profile.language')}
        trailing={
          <MenuPicker<LanguagePreference>
            value={language}
            accessibilityLabel={t('profile.language')}
            onChange={session.setLanguage}
            options={[
              { value: 'system', label: t('profile.languageSystem') },
              { value: 'en', label: t('profile.english') },
              { value: 'ar', label: t('profile.arabic') },
            ]}
          />
        }
      />
      <ListRow
        leadingIcon="tag"
        title={t('profile.currency')}
        trailing={
          <MenuPicker<Currency>
            value={currency}
            accessibilityLabel={t('profile.currency')}
            onChange={(value) => {
              session.setCurrency(value);
              void queryClient.invalidateQueries();
            }}
            options={currencies.map((code) => ({ value: code, label: code }))}
          />
        }
      />
      <ListRow
        leadingIcon="bell"
        title={t('profile.notifications')}
        trailing={<Switch value={notifications} onValueChange={session.setNotifications} accessibilityLabel={t('profile.notifications')} />}
      />
      <ListRow
        leadingIcon="lock"
        title={t('profile.faceId')}
        trailing={<Switch value={faceId} onValueChange={session.setFaceIdForPurchases} accessibilityLabel={t('profile.faceId')} />}
      />
    </ListGroup>
  );
}

export function AccountGroup() {
  const { t } = useTranslation();
  const soon = () => toast.show({ message: t('common.comingSoon') });
  return (
    <ListGroup header={t('profile.account')}>
      <ListRow leadingIcon="gift" title={t('profile.rewards')} onPress={() => router.push('/rewards')} />
      <ListRow leadingIcon="qr" title={t('profile.invoices')} onPress={soon} />
    </ListGroup>
  );
}

const siteUrl = process.env.EXPO_PUBLIC_SITE_URL?.replace(/\/$/, '');

function openLegal(page: 'privacy' | 'terms', fallback: () => void) {
  if (!siteUrl) return fallback();
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  void WebBrowser.openBrowserAsync(`${siteUrl}/${language}/${page}`);
}

export function HelpGroup() {
  const { t } = useTranslation();
  const soon = () => toast.show({ message: t('common.comingSoon') });
  return (
    <ListGroup header={t('profile.help')}>
      <ListRow leadingIcon="chat" title={t('profile.support')} onPress={() => router.push('/support')} />
      <ListRow leadingIcon="help" title={t('profile.helpCentre')} onPress={soon} />
      <ListRow leadingIcon="sim" title={t('profile.compatibility')} onPress={soon} />
      <ListRow leadingIcon="lock" title={t('profile.privacy')} onPress={() => openLegal('privacy', soon)} />
      <ListRow leadingIcon="info" title={t('profile.terms')} onPress={() => openLegal('terms', soon)} />
    </ListGroup>
  );
}

export function DeveloperGroup() {
  const { t } = useTranslation();
  const scenario = useDevStore((state) => state.scenario);
  const setScenario = useDevStore((state) => state.setScenario);
  const resetOnboarding = useSession((state) => state.resetOnboarding);
  if (!__DEV__) return null;
  return (
    <ListGroup header={t('profile.developer')}>
      <ListRow
        leadingIcon="sparkles"
        title={t('profile.scenario')}
        trailing={
          <MenuPicker<DevScenario>
            value={scenario}
            accessibilityLabel={t('profile.scenario')}
            onChange={setScenario}
            options={devScenarios.map((value) => ({ value, label: t(`scenarios.${value}`) }))}
          />
        }
      />
      <ListRow leadingIcon="bolt" title={t('profile.components')} onPress={() => router.push('/dev/components')} />
      <ListRow leadingIcon="arrowBack" title={t('profile.resetOnboarding')} onPress={resetOnboarding} />
    </ListGroup>
  );
}

export function SignOutRow() {
  const { t } = useTranslation();
  const signOut = () => void signOutDevice();
  return (
    <ListGroup>
      <ListRow
        title={t('profile.signOut')}
        destructive
        chevron={false}
        onPress={() =>
          Alert.alert(t('profile.signOutTitle'), t('profile.signOutBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('profile.signOut'), style: 'destructive', onPress: signOut },
          ])
        }
      />
      <ListRow
        title={t('profile.deleteAccount')}
        destructive
        chevron={false}
        onPress={() =>
          Alert.alert(t('profile.deleteTitle'), t('profile.deleteBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
              text: t('profile.deleteConfirm'),
              style: 'destructive',
              onPress: () => {
                deleteAccount().catch(() => toast.show({ message: t('profile.deleteFailed'), tone: 'danger' }));
              },
            },
          ])
        }
      />
    </ListGroup>
  );
}
