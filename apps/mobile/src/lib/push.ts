import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import i18n from '@/i18n';
import { authHeaders, signOutEverywhere } from './auth';
import { liveActivity } from './liveActivity';

const baseURL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const CHANNEL = 'trips';

let deviceToken: string | null = null;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

async function call(method: 'POST' | 'DELETE', path: string, body?: unknown): Promise<void> {
  if (!baseURL) return;
  const response = await fetch(`${baseURL}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${path} failed with ${response.status}`);
}

export async function registerPush({ prompt }: { prompt: boolean }): Promise<boolean> {
  if (!baseURL || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return false;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && prompt) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: i18n.t('notifications.channel'),
        importance: AndroidImportance.HIGH,
      });
    }
    const { data } = await Notifications.getDevicePushTokenAsync();
    deviceToken = String(data);
    await call('POST', '/v1/devices', { platform: Platform.OS, push_token: deviceToken, locale: i18n.language });
    return true;
  } catch {
    return false;
  }
}

export async function signOutDevice() {
  if (deviceToken) await call('DELETE', '/v1/devices', { push_token: deviceToken }).catch(() => undefined);
  deviceToken = null;
  await signOutEverywhere();
}

function openFrom(response: Notifications.NotificationResponse | null) {
  const data = response?.notification.request.content.data;
  if (data?.kind === 'support') {
    const chat = data.conversation_id;
    router.push(typeof chat === 'string' && /^[0-9a-f-]{36}$/i.test(chat) ? { pathname: '/support', params: { chat } } : '/support');
    return;
  }
  const iccid = data?.iccid;
  if (typeof iccid === 'string' && /^\d{19,20}$/.test(iccid)) router.push({ pathname: '/usage/[iccid]', params: { iccid } });
}

export function startPushSync(): () => void {
  if (!baseURL) return () => undefined;
  openFrom(Notifications.getLastNotificationResponse());
  const responses = Notifications.addNotificationResponseReceivedListener(openFrom);
  const tokens = liveActivity.onPushToken(({ iccid, token }) => {
    void call('POST', `/v1/esims/${iccid}/live-activity`, {
      push_token: token,
      locale: i18n.language,
      ...(deviceToken ? { device_token: deviceToken } : {}),
    }).catch(() => undefined);
  });
  const relocalise = () => void registerPush({ prompt: false });
  i18n.on('languageChanged', relocalise);
  void registerPush({ prompt: false });
  return () => {
    responses.remove();
    tokens();
    i18n.off('languageChanged', relocalise);
  };
}

export async function forgetLiveActivity(iccid: string) {
  await call('DELETE', `/v1/esims/${iccid}/live-activity`).catch(() => undefined);
}
