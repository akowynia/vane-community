'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { Locale, LocaleInfo, Translations } from './types';
import { en } from './locales/en';
import { pl } from './locales/pl';
import { es } from './locales/es';
import { de } from './locales/de';
import { fr } from './locales/fr';
import { it } from './locales/it';
import { pt } from './locales/pt';
import { ru } from './locales/ru';
import { uk } from './locales/uk';
import { zh } from './locales/zh';
import { ja } from './locales/ja';
import { ko } from './locales/ko';

export const dictionaries: Record<Locale, Translations> = {
  en,
  pl,
  es,
  de,
  fr,
  it,
  pt,
  ru,
  uk,
  zh,
  ja,
  ko,
};

export const AVAILABLE_LOCALES: LocaleInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська' },
  { code: 'zh', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
];

export const DEFAULT_LOCALE: Locale = 'en';

export const getStoredLocale = (): Locale => {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = localStorage.getItem('language');
  if (stored && stored in dictionaries) {
    return stored as Locale;
  }
  return DEFAULT_LOCALE;
};

// Nested key resolver helper (e.g., 'common.save' or 'chat.researchProgress')
export const resolveTranslation = (
  dict: Translations,
  fallbackDict: Translations,
  keyPath: string,
  params?: Record<string, any>,
): string => {
  const parts = keyPath.split('.');
  let current: any = dict;
  let fallbackCurrent: any = fallbackDict;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      current = undefined;
      break;
    }
  }

  // Fallback to English if key path not found in current dictionary
  if (current === undefined || typeof current !== 'string') {
    for (const part of parts) {
      if (fallbackCurrent && typeof fallbackCurrent === 'object' && part in fallbackCurrent) {
        fallbackCurrent = fallbackCurrent[part];
      } else {
        fallbackCurrent = undefined;
        break;
      }
    }
    current = typeof fallbackCurrent === 'string' ? fallbackCurrent : keyPath;
  }

  if (typeof current !== 'string') {
    return keyPath;
  }

  // Interpolate variables like {count}, {results}, etc.
  if (params) {
    let result = current;
    for (const [key, value] of Object.entries(params)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
    return result;
  }

  return current;
};

interface I18nContextType {
  locale: Locale;
  setLocale: (newLocale: Locale) => void;
  t: (keyPath: string, params?: Record<string, any>) => string;
  dictionary: Translations;
  availableLocales: LocaleInfo[];
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const initial = getStoredLocale();
    setLocaleState(initial);

    const handleConfigChange = () => {
      const updated = getStoredLocale();
      setLocaleState(updated);
    };

    window.addEventListener('client-config-changed', handleConfigChange);
    window.addEventListener('storage', handleConfigChange);

    return () => {
      window.removeEventListener('client-config-changed', handleConfigChange);
      window.removeEventListener('storage', handleConfigChange);
    };
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    if (newLocale in dictionaries) {
      setLocaleState(newLocale);
      if (typeof window !== 'undefined') {
        localStorage.setItem('language', newLocale);
        window.dispatchEvent(new Event('client-config-changed'));
      }
    }
  }, []);

  const dictionary = useMemo(() => {
    return dictionaries[locale] || dictionaries[DEFAULT_LOCALE];
  }, [locale]);

  const t = useCallback(
    (keyPath: string, params?: Record<string, any>): string => {
      return resolveTranslation(dictionary, dictionaries[DEFAULT_LOCALE], keyPath, params);
    },
    [dictionary],
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      dictionary,
      availableLocales: AVAILABLE_LOCALES,
    }),
    [locale, setLocale, t, dictionary],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    // Fallback if rendered outside of I18nProvider
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (keyPath: string, params?: Record<string, any>) =>
        resolveTranslation(dictionaries[DEFAULT_LOCALE], dictionaries[DEFAULT_LOCALE], keyPath, params),
      dictionary: dictionaries[DEFAULT_LOCALE],
      availableLocales: AVAILABLE_LOCALES,
    };
  }
  return context;
};

export default I18nProvider;
