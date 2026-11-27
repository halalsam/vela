import type { DailyUsage, Esim } from '@vela/api';
import type { EsimRow } from '../models/esim.model';
import type { PlanRow } from '../models/plan.model';
import { leftLabel, statusLabel, type Locale } from './messages.view';

/** `lpa` is the decrypted LPA string; the row only holds it encrypted. */
export function esimView(row: EsimRow, planRow: PlanRow, lpa: string): Esim {
  return {
    iccid: row.iccid,
    plan_id: row.planId,
    label: row.label,
    country_codes: planRow.countryCodes,
    network: planRow.networks[0] ?? 'Partner network',
    is_5g: planRow.is5g,
    status: row.status,
    data_used_mb: row.dataUsedMb,
    data_total_mb: row.dataTotalMb,
    activated_at: row.activatedAt?.toISOString() ?? null,
    expires_at: row.expiresAt?.toISOString() ?? null,
    lpa_string: lpa,
    qr_url: null,
  };
}

/** The short label shown on the eSIM card, e.g. "JP · 5 GB". */
export function esimLabel(planRow: PlanRow): string {
  const place = planRow.type === 'country' ? (planRow.countryCodes[0] ?? '') : (planRow.regionId ?? planRow.type);
  const size = planRow.dataMb >= 1024 ? `${Math.round(planRow.dataMb / 1024)} GB` : `${planRow.dataMb} MB`;
  return `${place.toUpperCase()} · ${size}`;
}

export function dailyUsageView(date: string, usedMb: number): DailyUsage {
  return { date, used_mb: usedMb };
}

const APPLE_EPOCH_SECONDS = 978_307_200;

/** Seconds since 2001-01-01, the reference date iOS uses for ActivityKit content state. */
export function appleDate(date: Date): number {
  return date.getTime() / 1000 - APPLE_EPOCH_SECONDS;
}

/** The content state of the iOS trip Live Activity. */
export function tripContentState(row: Pick<EsimRow, 'status' | 'dataUsedMb' | 'dataTotalMb' | 'expiresAt'>, locale: Locale) {
  const state = { status: row.status, usedMb: row.dataUsedMb, totalMb: row.dataTotalMb };
  return {
    usedMB: row.dataUsedMb,
    totalMB: row.dataTotalMb,
    ...(row.expiresAt ? { expiresAt: appleDate(row.expiresAt) } : {}),
    status: row.status,
    leftLabel: leftLabel(state),
    statusLabel: statusLabel(state, locale),
  };
}
