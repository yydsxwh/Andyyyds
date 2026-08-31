"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { AppLocale } from "@andyyyds/shared/i18n/locales";
import { translateMessage } from "@andyyyds/shared/i18n/messages";

type LocaleContextValue = {
  locale: AppLocale;
  bilingual: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  locale,
  bilingual,
  children,
}: {
  locale: AppLocale;
  bilingual: boolean;
  children: ReactNode;
}) {
  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      bilingual,
      t: (key, vars) => translateMessage(locale, key, vars),
    }),
    [locale, bilingual],
  );
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      locale: "zh-Hans",
      bilingual: false,
      t: (key, vars) => translateMessage("zh-Hans", key, vars),
    };
  }
  return ctx;
}
