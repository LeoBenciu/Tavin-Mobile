import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { storage, StorageKeys } from '@/lib/storage';

export type Language = 'ro' | 'en';

/**
 * Strings are written as Romanian/English pairs at the call site — t('Facturi',
 * 'Invoices') — the same convention as the web portal's uiText(ro, en).
 */
export type Translate = (ro: string, en: string) => string;

let currentLanguage: Language = defaultLanguage();

function defaultLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code && code !== 'ro' ? 'en' : 'ro';
}

/** For non-React code (API headers, push handlers). */
export function getLanguage(): Language {
  return currentLanguage;
}

export function translate(ro: string, en: string): string {
  return currentLanguage === 'ro' ? ro : en;
}

type LanguageContextValue = { language: Language; setLanguage: (l: Language) => void };

const LanguageContext = createContext<LanguageContextValue>({
  language: currentLanguage,
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(currentLanguage);

  useEffect(() => {
    storage.get(StorageKeys.language).then((saved) => {
      if (saved === 'ro' || saved === 'en') {
        currentLanguage = saved;
        setLanguageState(saved);
      }
    });
  }, []);

  const setLanguage = useCallback((l: Language) => {
    currentLanguage = l;
    setLanguageState(l);
    void storage.set(StorageKeys.language, l);
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useT(): Translate {
  const { language } = useContext(LanguageContext);
  return useCallback((ro: string, en: string) => (language === 'ro' ? ro : en), [language]);
}
