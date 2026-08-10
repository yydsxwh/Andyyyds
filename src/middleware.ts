import { NextResponse, type NextRequest } from "next/server";
import {
  LOCALE_COOKIE,
  SUPPORTED_LOCALES,
  isAppLocale,
  type AppLocale,
} from "@/lib/i18n/locales";
import { resolveLocaleFromAcceptLanguage } from "@/lib/i18n/resolve-locale";

/**
 * 无 cookie 时按 Accept-Language 写入 yyds_locale，稳定后续请求语言。
 * 不强制覆盖已有 cookie（便于调试手动切换）。
 */
export function middleware(req: NextRequest) {
  const existing = req.cookies.get(LOCALE_COOKIE)?.value;
  if (existing && isAppLocale(existing)) {
    return NextResponse.next();
  }

  const locale: AppLocale = resolveLocaleFromAcceptLanguage(
    req.headers.get("accept-language"),
    [...SUPPORTED_LOCALES],
    "zh-Hans",
  );

  const res = NextResponse.next();
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return res;
}

export const config = {
  matcher: [
    /*
     * 跳过静态资源与 API 文件流；页面请求写入 locale cookie
     */
    "/((?!_next/static|_next/image|favicon.ico|brand/|uploads/|api/chat/ws).*)",
  ],
};
