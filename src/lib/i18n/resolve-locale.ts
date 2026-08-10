import {
  isAppLocale,
  SOURCE_LOCALE,
  type AppLocale,
} from "@/lib/i18n/locales";

/**
 * 从 Accept-Language 解析站点 locale。
 * zh-TW/HK/MO → 繁体；zh-CN / 裸 zh → 简体；en* → en；其余按已启用列表匹配。
 */
export function resolveLocaleFromAcceptLanguage(
  acceptLanguage: string | null | undefined,
  enabled: AppLocale[],
  fallback: AppLocale = SOURCE_LOCALE,
): AppLocale {
  const enabledSet = new Set(enabled.length ? enabled : [SOURCE_LOCALE]);
  const pick = (locale: AppLocale): AppLocale | null =>
    enabledSet.has(locale) ? locale : null;

  const tags = parseAcceptLanguage(acceptLanguage);
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    if (lower.startsWith("zh")) {
      if (
        lower.includes("tw") ||
        lower.includes("hk") ||
        lower.includes("mo") ||
        lower.includes("hant")
      ) {
        const hant = pick("zh-Hant");
        if (hant) return hant;
      }
      const hans = pick("zh-Hans");
      if (hans) return hans;
      continue;
    }
    if (lower.startsWith("en")) {
      const en = pick("en");
      if (en) return en;
      continue;
    }
    // fil / tl 都映射到 Filipino
    if (lower.startsWith("fil") || lower.startsWith("tl")) {
      const fil = pick("fil");
      if (fil) return fil;
      continue;
    }
    const primary = lower.split("-")[0] || "";
    if (isAppLocale(primary)) {
      const hit = pick(primary);
      if (hit) return hit;
    }
  }

  if (enabledSet.has(fallback)) return fallback;
  if (enabledSet.has("en")) return "en";
  if (enabledSet.has(SOURCE_LOCALE)) return SOURCE_LOCALE;
  return enabled[0] || SOURCE_LOCALE;
}

function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header?.trim()) return [];
  return header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      let q = 1;
      for (const p of params) {
        const m = /q\s*=\s*([\d.]+)/i.exec(p);
        if (m) q = Number(m[1]) || 0;
      }
      return { tag: (tag || "").trim(), q };
    })
    .filter((x) => x.tag)
    .sort((a, b) => b.q - a.q)
    .map((x) => x.tag);
}

/** cookie / 调试覆盖优先于 Accept-Language */
export function resolveRequestLocale(input: {
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
  enabled: AppLocale[];
  fallback: AppLocale;
}): AppLocale {
  const cookie = (input.cookieLocale || "").trim();
  if (cookie && isAppLocale(cookie) && input.enabled.includes(cookie)) {
    return cookie;
  }
  return resolveLocaleFromAcceptLanguage(
    input.acceptLanguage,
    input.enabled,
    input.fallback,
  );
}
