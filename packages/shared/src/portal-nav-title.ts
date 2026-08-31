/**
 * 标签页标题跟门户导航同一套名称：站长改过用 CMS 名，没改过才走语言包。
 */

import { getRequestLocaleContext } from "@andyyyds/shared/i18n/get-request-locale";
import { translateMessage } from "@andyyyds/shared/i18n/messages";
import { navMessageKey } from "@andyyyds/shared/i18n/nav-labels";
import { resolveContentText } from "@andyyyds/shared/i18n/content-resolve";
import { getPortalConfig } from "@andyyyds/shared/site-settings";

export async function getPortalNavPageTitle(
  key: string,
  fallback: string,
): Promise<string> {
  const [portal, localeCtx] = await Promise.all([
    getPortalConfig(),
    getRequestLocaleContext(),
  ]);
  const item = portal.nav.find((nav) => nav.key === key);
  const raw = (item?.label || "").trim() || fallback;
  const catalogKey = navMessageKey({ label: raw });
  if (catalogKey) {
    return localeCtx.bilingual
      ? raw
      : translateMessage(localeCtx.locale, catalogKey);
  }
  const resolved = await resolveContentText({
    entityType: "portal",
    entityId: "default",
    field: `nav.${key}.label`,
    source: raw,
    locale: localeCtx.contentLocale,
  });
  return localeCtx.bilingual ? resolved.source : resolved.text;
}
