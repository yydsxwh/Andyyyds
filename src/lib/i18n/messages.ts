import type { AppLocale } from "@/lib/i18n/locales";
import { SOURCE_LOCALE } from "@/lib/i18n/locales";
import de from "@/locales/de.json";
import en from "@/locales/en.json";
import es from "@/locales/es.json";
import fil from "@/locales/fil.json";
import fr from "@/locales/fr.json";
import ja from "@/locales/ja.json";
import pt from "@/locales/pt.json";
import vi from "@/locales/vi.json";
import zhHans from "@/locales/zh-Hans.json";
import zhHant from "@/locales/zh-Hant.json";

export type MessageKey = keyof typeof zhHans;

const CATALOGS: Record<AppLocale, Record<string, string>> = {
  "zh-Hans": zhHans,
  "zh-Hant": zhHant,
  en,
  es,
  ja,
  fr,
  de,
  vi,
  fil,
  pt,
};

export function translateMessage(
  locale: AppLocale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const catalog = CATALOGS[locale] || CATALOGS[SOURCE_LOCALE];
  let text =
    catalog[key] ||
    CATALOGS.en[key] ||
    CATALOGS[SOURCE_LOCALE][key] ||
    key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export function getMessageCatalog(locale: AppLocale): Record<string, string> {
  return CATALOGS[locale] || CATALOGS[SOURCE_LOCALE];
}
