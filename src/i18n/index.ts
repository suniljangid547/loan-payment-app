import i18nDefault, {
  changeLanguage,
  use as i18nUse,
  t as i18nextT,
} from 'i18next';
import { initReactI18next } from 'react-i18next';

import { en, hi, hinglish, type TranslationKey } from './translations';
import { useSettings } from '@/store/settings';

i18nUse(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    hinglish: { translation: hinglish },
  },
  lng: useSettings.getState().language,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

useSettings.subscribe((s, prev) => {
  if (s.language !== prev.language) void changeLanguage(s.language);
});

export default i18nDefault;
export type { TranslationKey };
export const t = (key: TranslationKey, opts?: Record<string, string | number>): string =>
  i18nextT(key, opts ?? {});
