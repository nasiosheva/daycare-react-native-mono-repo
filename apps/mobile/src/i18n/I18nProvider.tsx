import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { loadLocale, saveLocale } from "./localeStorage";
import { localeTags, supportedLocales, translate, type AppLocale, type TranslationKey } from "./translations";

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  formatCurrency: (value: number) => string;
  formatDate: (value: string | Date) => string;
  formatDateTime: (value: string | Date) => string;
  formatTime: (value: string | Date) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, updateLocale] = useState<AppLocale>("id");
  useEffect(() => { void loadLocale().then((stored) => { if (stored && (supportedLocales as readonly string[]).includes(stored)) updateLocale(stored as AppLocale); }); }, []);
  const setLocale = useCallback(async (nextLocale: AppLocale) => { updateLocale(nextLocale); await saveLocale(nextLocale); }, []);
  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t: (key, params) => translate(locale, key, params),
    formatCurrency: (amount) => new Intl.NumberFormat(localeTags[locale], { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number.isFinite(amount) ? amount : 0),
    formatDate: (date) => new Intl.DateTimeFormat(localeTags[locale], { dateStyle: "medium" }).format(new Date(date)),
    formatDateTime: (date) => new Intl.DateTimeFormat(localeTags[locale], { dateStyle: "medium", timeStyle: "short" }).format(new Date(date)),
    formatTime: (date) => new Intl.DateTimeFormat(localeTags[locale], { timeStyle: "short" }).format(new Date(date)),
  }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
