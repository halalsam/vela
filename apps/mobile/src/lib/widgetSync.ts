import { ExtensionStorage } from '@bacons/apple-targets';
import type { Country, Esim, Region } from '@vela/api';
import { flagEmoji, formatData, isLowData } from '@vela/utils';
import { Platform } from 'react-native';
import i18n from '@/i18n';
import { queryKeys } from '@/queries';
import { liveActivity, type TripState } from './liveActivity';
import { queryClient } from './queryClient';

const APP_GROUP = 'group.com.sammk21.vela';
const WIDGET_KEY = 'vela.widget';

const storage = Platform.OS === 'ios' ? new ExtensionStorage(APP_GROUP) : null;

function destinationName(esim: Esim): string {
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  const regionId = esim.plan_id.split('-')[0];
  const regions = queryClient.getQueryData<Region[]>(queryKeys.regions);
  const region = regions?.find((item) => item.id === regionId);
  if (region) return region.name[language];
  const countries = queryClient.getQueryData<Country[]>(queryKeys.countries);
  const country = countries?.find((item) => item.code === esim.country_codes[0]);
  return country?.name[language] ?? esim.label;
}

function statusLabel(esim: Esim): string {
  if (esim.status === 'not_started') return i18n.t('esim.statusNotStarted');
  if (esim.status === 'expired' || esim.status === 'depleted') return i18n.t('esim.statusExpired');
  return isLowData(esim.data_used_mb, esim.data_total_mb) ? i18n.t('esim.low') : i18n.t('esim.active');
}

function leftText(esim: Esim): string {
  if (esim.status === 'not_started') return formatData(esim.data_total_mb);
  return formatData(Math.max(0, esim.data_total_mb - esim.data_used_mb));
}

export function tripLabel(esim: Esim): string {
  return `${destinationName(esim)} · ${formatData(esim.data_total_mb)}`;
}

export function tripStateFor(esim: Esim): TripState {
  return {
    usedMB: esim.data_used_mb,
    totalMB: esim.data_total_mb,
    expiresAt: esim.expires_at ? Date.parse(esim.expires_at) : null,
    status: esim.status,
    leftLabel: leftText(esim),
    statusLabel: statusLabel(esim),
  };
}

export function tripStartFor(esim: Esim) {
  return {
    iccid: esim.iccid,
    label: tripLabel(esim),
    flag: flagEmoji(esim.country_codes.length === 1 ? (esim.country_codes[0] ?? '') : 'UN'),
    state: tripStateFor(esim),
  };
}

export function syncWidgets(esims: readonly Esim[]) {
  if (!storage) return;
  const payload = {
    updatedAt: Date.now(),
    emptyTitle: i18n.t('home.noTripsTitle'),
    emptyBody: i18n.t('home.noTripsBody'),
    leftWord: i18n.t('esim.left'),
    esims: esims.map((esim) => ({
      iccid: esim.iccid,
      label: tripLabel(esim),
      flag: flagEmoji(esim.country_codes.length === 1 ? (esim.country_codes[0] ?? '') : 'UN'),
      usedMB: esim.data_used_mb,
      totalMB: esim.data_total_mb,
      leftText: leftText(esim),
      ofText: i18n.t('esim.ofTotal', { total: formatData(esim.data_total_mb) }),
      expiresAt: esim.expires_at ? Date.parse(esim.expires_at) : null,
      status: esim.status,
      statusText: statusLabel(esim),
    })),
  };
  storage.set(WIDGET_KEY, JSON.stringify(payload));
  ExtensionStorage.reloadWidget();

  const tracked = new Set(liveActivity.trackedIccids());
  for (const esim of esims) {
    if (!tracked.has(esim.iccid)) continue;
    if (esim.status === 'expired' || esim.status === 'depleted') void liveActivity.end(esim.iccid);
    else void liveActivity.update(esim.iccid, tripStateFor(esim));
  }
}

let started = false;

export function startWidgetSync() {
  if (started || Platform.OS !== 'ios') return;
  started = true;
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    if (event.query.queryKey[0] !== queryKeys.esims[0]) return;
    syncWidgets(event.query.state.data as Esim[]);
  });
  i18n.on('languageChanged', () => {
    const esims = queryClient.getQueryData<Esim[]>(queryKeys.esims);
    if (esims) syncWidgets(esims);
  });
}
