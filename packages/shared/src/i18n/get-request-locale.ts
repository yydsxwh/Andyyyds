import { cookies, headers } from "next/headers";
import {
  LOCALE_COOKIE,
  LOCALE_HTML_LANG,
  SOURCE_LOCALE,
  isAppLocale,
  parseEnabledLocalesJson,
  type AppLocale,
} from "@andyyyds/shared/i18n/locales";
import { resolveRequestLocale } from "@andyyyds/shared/i18n/resolve-locale";
import { isAdmin } from "@andyyyds/shared/roles";
import { getSession } from "@andyyyds/shared/auth";

/** 站长双语时默认配对的第二语言（中文母语站长也能并排看到英文） */
export const OWNER_PAIR_LOCALE: AppLocale = "en";

export type RequestLocaleContext = {
  /** 界面词条 / html lang：跟浏览器（或 cookie） */
  locale: AppLocale;
  htmlLang: string;
  /**
   * 正文解析用语言。
   * 站长双语且浏览器为简中时固定为 en，以便拉出英文缓存并与中文原文并排。
   */
  contentLocale: AppLocale;
  /** 站长前台并排显示中文原文 + 英文（或当前 contentLocale）译文 */
  bilingual: boolean;
  enabledLocales: AppLocale[];
  defaultLocale: AppLocale;
};

/** 服务端读取当前请求的展示语言与站长双语标记 */
export async function getRequestLocaleContext(): Promise<RequestLocaleContext> {
  const { getSiteSettings } = await import("@andyyyds/shared/site-settings");
  const settings = await getSiteSettings();
  const enabledLocales = parseEnabledLocalesJson(
    (settings as { enabledLocalesJson?: string }).enabledLocalesJson,
  );
  const rawDefault = String(
    (settings as { defaultLocale?: string }).defaultLocale || SOURCE_LOCALE,
  ).trim();
  const defaultLocale = isAppLocale(rawDefault) ? rawDefault : SOURCE_LOCALE;

  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = resolveRequestLocale({
    cookieLocale: cookieStore.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerStore.get("accept-language"),
    enabled: enabledLocales,
    fallback: defaultLocale,
  });

  const session = await getSession();
  // 站长始终开双语，不依赖浏览器是否为外语
  const bilingual = Boolean(session && isAdmin(session.role));
  // 浏览器已是简中时，正文侧改用英语，才能并排出「中 + 英」
  const contentLocale: AppLocale =
    bilingual && locale === SOURCE_LOCALE
      ? OWNER_PAIR_LOCALE
      : locale;

  return {
    locale,
    htmlLang: LOCALE_HTML_LANG[locale],
    contentLocale,
    bilingual,
    enabledLocales,
    defaultLocale,
  };
}
