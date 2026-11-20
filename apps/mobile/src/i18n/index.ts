import { createInstance } from 'i18next';
import { getLocales } from 'expo-localization';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';

export const supportedLanguages = ['en', 'ar'] as const;
export type Language = (typeof supportedLanguages)[number];

function deviceLanguage(): Language {
  return getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
