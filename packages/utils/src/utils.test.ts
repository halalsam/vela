import { describe, expect, it } from 'vitest';
import {
  bestValuePlanId,
  countdownParts,
  dataParts,
  flagEmoji,
  formatShortDate,
  formatData,
  formatPrice,
  isLowData,
  pricePerGb,
  remainingFraction,
} from './index';

describe('formatPrice', () => {
  it('formats rupees with Indian grouping and no decimals for whole amounts', () => {
    expect(formatPrice(1199, 'INR')).toBe('₹1,199');
    expect(formatPrice(149999, 'INR')).toBe('₹1,49,999');
  });

  it('keeps two decimals for fractional amounts', () => {
    expect(formatPrice(19.5, 'AED')).toBe('AED 19.50');
  });

  it('uses Latin digits for Gulf currencies', () => {
    expect(formatPrice(45, 'SAR')).toMatch(/^SAR\s?45$/);
  });
});

describe('data', () => {
  it('switches between MB and GB', () => {
    expect(formatData(500)).toBe('500 MB');
    expect(formatData(3891)).toBe('3.8 GB');
    expect(formatData(10240)).toBe('10 GB');
    expect(dataParts(1536)).toEqual({ value: '1.5', unit: 'GB' });
  });

  it('clamps remaining fraction', () => {
    expect(remainingFraction(2000, 1000)).toBe(0);
    expect(remainingFraction(0, 0)).toBe(0);
    expect(remainingFraction(250, 1000)).toBe(0.75);
  });

  it('flags low data by share or by absolute amount', () => {
    expect(isLowData(9000, 10240)).toBe(true);
    expect(isLowData(2700, 3072)).toBe(true);
    expect(isLowData(1000, 10240)).toBe(false);
    expect(isLowData(10240, 10240)).toBe(false);
  });
});

describe('plans', () => {
  const plans = [
    { id: 'a', data_mb: 3072, price: 499 },
    { id: 'b', data_mb: 10240, price: 1199 },
    { id: 'c', data_mb: 20480, price: 1999 },
  ];

  it('computes price per GB', () => {
    expect(Math.round(pricePerGb(plans[0]!))).toBe(166);
  });

  it('picks the lowest price per GB as best value', () => {
    expect(bestValuePlanId(plans)).toBe('c');
    expect(bestValuePlanId([plans[0]!])).toBeUndefined();
  });
});

describe('countdownParts', () => {
  it('splits the remaining time', () => {
    const now = Date.parse('2026-11-20T10:00:00Z');
    expect(countdownParts('2026-11-27T00:42:18Z', now)).toMatchObject({ days: 6, hours: 14, minutes: 42, seconds: 18, expired: false });
  });

  it('reports expiry', () => {
    expect(countdownParts('2026-01-01T00:00:00Z', Date.parse('2026-02-01T00:00:00Z')).expired).toBe(true);
  });
});

describe('flagEmoji', () => {
  it('builds regional indicator pairs', () => {
    expect(flagEmoji('jp')).toBe('🇯🇵');
    expect(flagEmoji('XYZ')).toBe('🏳️');
  });
});

describe('formatShortDate', () => {
  it('formats day and short month with Latin digits in both languages', () => {
    expect(formatShortDate('2026-11-28T12:00:00Z', 'en')).toBe('28 Nov');
    expect(formatShortDate('2026-11-28T12:00:00Z', 'ar')).toMatch(/^28 /);
  });
});
