import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useSchoolProfile } from './SchoolProfileContext.jsx';
import bnDict from '../locales/bn.json';
import enDict from '../locales/en.json';

const LanguageContext = createContext(null);
const LANGUAGE_STORAGE_KEY = 'scholastic_app_language';

const dictionaries = {
  bn: bnDict,
  en: enDict,
};

export function LanguageProvider({ children }) {
  const { schoolProfile } = useSchoolProfile();
  const [lang, setLangState] = useState(() => {
    try {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored === 'en' || stored === 'bn') return stored;
    } catch {}
    return schoolProfile?.language || 'bn';
  });

  // Sync with schoolProfile.language whenever Firestore updates schoolProfile
  useEffect(() => {
    if (schoolProfile?.language && (schoolProfile.language === 'bn' || schoolProfile.language === 'en')) {
      setLangState(schoolProfile.language);
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, schoolProfile.language);
      } catch {}
    }
  }, [schoolProfile?.language]);

  const changeLanguage = useCallback((newLang) => {
    const valid = newLang === 'en' ? 'en' : 'bn';
    setLangState(valid);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, valid);
      window.dispatchEvent(new CustomEvent('scholasticLanguageChange', { detail: { lang: valid } }));
    } catch {}
  }, []);

  // Listen to same-tab / cross-tab language change events
  useEffect(() => {
    const handleCustomEvent = (e) => {
      if (e.detail?.lang && (e.detail.lang === 'bn' || e.detail.lang === 'en')) {
        setLangState(e.detail.lang);
      }
    };
    const handleStorageEvent = (e) => {
      if (e.key === LANGUAGE_STORAGE_KEY && (e.newValue === 'bn' || e.newValue === 'en')) {
        setLangState(e.newValue);
      }
    };

    window.addEventListener('scholasticLanguageChange', handleCustomEvent);
    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('scholasticLanguageChange', handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  /**
   * Translate function using dot notation keys.
   * Example: t('common.save') -> "সংরক্ষণ করুন" (if bn) or "Save" (if en)
   */
  const t = useCallback((path, fallback = '') => {
    if (!path) return fallback;
    const currentDict = dictionaries[lang] || dictionaries.bn;
    const fallbackDict = dictionaries.bn;

    const resolvePath = (dict, keyPath) => {
      const keys = String(keyPath).split('.');
      let current = dict;
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          return undefined;
        }
      }
      return current;
    };

    const val = resolvePath(currentDict, path) ?? resolvePath(fallbackDict, path);
    if (val !== undefined && val !== null) {
      return val;
    }
    return fallback || path;
  }, [lang]);

  const value = useMemo(() => ({
    lang,
    language: lang,
    setLanguage: changeLanguage,
    changeLanguage,
    t,
    isBangla: lang === 'bn',
    isEnglish: lang === 'en',
  }), [lang, changeLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if consumed outside Provider
    return {
      lang: 'bn',
      language: 'bn',
      setLanguage: () => {},
      changeLanguage: () => {},
      t: (path, fallback) => fallback || path,
      isBangla: true,
      isEnglish: false,
    };
  }
  return context;
}
