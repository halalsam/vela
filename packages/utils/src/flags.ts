const REGIONAL_INDICATOR_A = 0x1f1e6;

export function flagEmoji(countryCode: string): string {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️';
  return String.fromCodePoint(...[...code].map((char) => REGIONAL_INDICATOR_A + char.charCodeAt(0) - 65));
}
