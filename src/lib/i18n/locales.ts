/**
 * 站点展示语种：源语言为简体中文（后台编辑），访客按浏览器语言匹配。
 */

export const SOURCE_LOCALE = "zh-Hans" as const;

/** 首期启用的语种（界面词条 + 可一键翻译正文） */
export const SUPPORTED_LOCALES = [
  "zh-Hans",
  "zh-Hant",
  "en",
  "es",
  "ja",
  "fr",
  "de",
  "vi",
  "fil",
  "pt",
] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABELS: Record<AppLocale, string> = {
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
  en: "English",
  es: "Español",
  ja: "日本語",
  fr: "Français",
  de: "Deutsch",
  vi: "Tiếng Việt",
  fil: "Filipino",
  pt: "Português",
};

/** html lang / Intl 用的 BCP 47 标签 */
export const LOCALE_HTML_LANG: Record<AppLocale, string> = {
  "zh-Hans": "zh-CN",
  "zh-Hant": "zh-TW",
  en: "en",
  es: "es",
  ja: "ja",
  fr: "fr",
  de: "de",
  vi: "vi",
  fil: "fil",
  pt: "pt",
};

/** 写入 cookie 的名称（调试覆盖或稳定访客语言） */
export const LOCALE_COOKIE = "yyds_locale";

export function isAppLocale(value: string): value is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function parseEnabledLocalesJson(raw: string | null | undefined): AppLocale[] {
  const trimmed = (raw || "").trim();
  if (!trimmed) return [...SUPPORTED_LOCALES];
  try {
    const arr = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(arr)) return [...SUPPORTED_LOCALES];
    const list = arr.filter((x): x is AppLocale => typeof x === "string" && isAppLocale(x));
    return list.length > 0 ? list : [...SUPPORTED_LOCALES];
  } catch {
    return [...SUPPORTED_LOCALES];
  }
}

export function stringifyEnabledLocales(locales: AppLocale[]): string {
  return JSON.stringify(locales);
}
