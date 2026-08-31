/**
 * 登录/注册默认渠道偏好。
 *
 * 为何默认偏微信：本站以国内学员为主，邮箱登录对多数人摩擦更大；
 * 仅在「明确海外」（非中文语言 + 非中国时区）时首屏改邮箱。
 */

/** Accept-Language 或 navigator.languages 串是否含中文 */
export function languageLooksChinese(acceptLanguage?: string | null): boolean {
  if (!acceptLanguage) return false;
  // zh / zh-CN / zh-Hans 等；避免误匹配 zh 子串
  return /(?:^|,)\s*zh\b/i.test(acceptLanguage);
}

const CHINA_TIME_ZONES = new Set([
  "Asia/Shanghai",
  "Asia/Urumqi",
  "Asia/Hong_Kong",
  "Asia/Macau",
  "Asia/Taipei",
  "Asia/Chongqing",
]);

export function timeZoneLooksChina(timeZone?: string | null): boolean {
  if (!timeZone) return false;
  return CHINA_TIME_ZONES.has(timeZone);
}

/**
 * 服务端首屏默认：有中文语言或缺少语言头 → 微信；
 * 缺少头按「非明确海外」处理，避免国内用户先看到邮箱。
 */
export function preferWechatFromAcceptLanguage(
  acceptLanguage?: string | null,
): boolean {
  if (!acceptLanguage?.trim()) return true;
  return languageLooksChinese(acceptLanguage);
}

/**
 * 浏览器端补强：微信内 / 中国时区 / 中文语言 → 微信；
 * 时区明确非中国且语言非中文 → 海外，优先邮箱；其余仍优先微信。
 */
export function preferWechatFromClient(options?: {
  inWeChat?: boolean;
}): boolean {
  if (typeof window === "undefined") return true;
  if (options?.inWeChat) return true;

  let tzChina: boolean | null = null;
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timeZone) tzChina = timeZoneLooksChina(timeZone);
  } catch {
    /* ignore */
  }

  const langs = [navigator.language, ...(navigator.languages || [])].join(",");
  const zh = languageLooksChinese(langs);
  if (zh || tzChina === true) return true;
  // 明确海外：非中国时区 + 非中文
  if (tzChina === false && langs.trim() && !zh) return false;
  return true;
}
