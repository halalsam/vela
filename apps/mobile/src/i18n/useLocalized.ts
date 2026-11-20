import type { Localized } from '@vela/api';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export function useLocalized() {
  const { i18n } = useTranslation();
  const language = i18n.language === 'ar' ? 'ar' : 'en';
  return useCallback((value: Localized) => value[language], [language]);
}
