import { getLocales } from 'expo-localization';
import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { useSession } from '@/stores/session';
import i18n from './index';

export function resolveLanguage(preference: 'system' | 'en' | 'ar'): 'en' | 'ar' {
  if (preference !== 'system') return preference;
  return getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';
}

export function directionNeedsRestart(preference: 'system' | 'en' | 'ar'): boolean {
  return I18nManager.isRTL !== (resolveLanguage(preference) === 'ar');
}

export function useLanguageSync() {
  const hydrated = useSession((state) => state.hydrated);
  const preference = useSession((state) => state.language);

  useEffect(() => {
    if (!hydrated) return;
    const language = resolveLanguage(preference);
    if (i18n.language !== language) void i18n.changeLanguage(language);
    const rtl = language === 'ar';
    if (I18nManager.isRTL !== rtl) {
      I18nManager.allowRTL(rtl);
      I18nManager.forceRTL(rtl);
    }
  }, [hydrated, preference]);
}
