import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

type IconSpec = {
  ios: SFSymbol;
  android: AndroidSymbol;
  mirror?: boolean;
};

export const icons = {
  chevronForward: { ios: 'chevron.right', android: 'chevron_right', mirror: true },
  chevronDown: { ios: 'chevron.down', android: 'expand_more' },
  arrowForward: { ios: 'arrow.right', android: 'arrow_forward', mirror: true },
  arrowBack: { ios: 'arrow.left', android: 'arrow_back', mirror: true },
  arrowUpForward: { ios: 'arrow.up.right', android: 'north_east', mirror: true },
  close: { ios: 'xmark', android: 'close' },
  check: { ios: 'checkmark', android: 'check' },
  checkCircle: { ios: 'checkmark.circle.fill', android: 'check_circle' },
  search: { ios: 'magnifyingglass', android: 'search' },
  copy: { ios: 'doc.on.doc', android: 'content_copy' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning' },
  info: { ios: 'info.circle', android: 'info' },
  error: { ios: 'xmark.octagon.fill', android: 'error' },
  clear: { ios: 'xmark.circle.fill', android: 'cancel' },
  offline: { ios: 'wifi.slash', android: 'wifi_off' },
  plus: { ios: 'plus', android: 'add' },
  globe: { ios: 'globe', android: 'public' },
  sim: { ios: 'simcard', android: 'sim_card' },
  bolt: { ios: 'bolt.fill', android: 'bolt' },
  gift: { ios: 'gift', android: 'redeem' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  lock: { ios: 'lock.fill', android: 'lock' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome' },
  qr: { ios: 'qrcode', android: 'qr_code_2' },
  clock: { ios: 'clock', android: 'schedule' },
  signal: { ios: 'antenna.radiowaves.left.and.right', android: 'signal_cellular_alt' },
  tag: { ios: 'tag', android: 'local_offer' },
  help: { ios: 'questionmark.circle', android: 'help' },
  chat: { ios: 'bubble.left', android: 'chat' },
  bell: { ios: 'bell', android: 'notifications' },
  language: { ios: 'character.bubble', android: 'language' },
} as const satisfies Record<string, IconSpec>;

export type IconName = keyof typeof icons;
