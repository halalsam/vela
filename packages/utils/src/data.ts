export const MB_PER_GB = 1024;

export type DataParts = { value: string; unit: 'GB' | 'MB' };

function trim(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function dataParts(mb: number, digits = 1): DataParts {
  const safe = Math.max(0, mb);
  if (safe >= MB_PER_GB) return { value: trim(safe / MB_PER_GB, digits), unit: 'GB' };
  return { value: trim(safe, 0), unit: 'MB' };
}

export function formatData(mb: number, digits = 1): string {
  const { value, unit } = dataParts(mb, digits);
  return `${value} ${unit}`;
}

export function remainingMb(usedMb: number, totalMb: number): number {
  return Math.max(0, totalMb - usedMb);
}

export function remainingFraction(usedMb: number, totalMb: number): number {
  if (totalMb <= 0) return 0;
  return Math.min(1, Math.max(0, remainingMb(usedMb, totalMb) / totalMb));
}

export const LOW_DATA_FRACTION = 0.15;
export const LOW_DATA_MB = 512;

export function isLowData(usedMb: number, totalMb: number): boolean {
  const left = remainingMb(usedMb, totalMb);
  return left > 0 && (remainingFraction(usedMb, totalMb) <= LOW_DATA_FRACTION || left <= LOW_DATA_MB);
}
