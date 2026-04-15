'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from '../../messages/en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: en,
      },
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    ns: ['auth', 'profile', 'common', 'dashboard', 'landing', 'layout', 'events', 'admin', 'organizer', 'enterprise', 'visitor'],
    defaultNS: 'common',
    detection: {
      order: ['localStorage', 'cookie', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
