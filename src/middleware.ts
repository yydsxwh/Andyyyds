import { NextResponse, type NextRequest } from "next/server";
import {
  LOCALE_COOKIE,
  SUPPORTED_LOCALES,
  isAppLocale,
  type AppLocale,
} from "@/lib/i18n/locales";
import { resolveLocaleFromAcceptLanguage } from "@/lib/i18n/resolve-locale";

/**
 * 无 cookie 时按 Accept-Language 写入 yyds_locale，稳定后续页面请求语言。
 * 不强制覆盖已有 cookie（便于调试手动切换）。
 *
 * 重要：不要拦截 /api/* 上传类请求。Next 在 middleware/proxy 里会缓冲 body，
 * 默认仅 10MB，素材中心视频上传会被截断后静默失败。
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // 双保险：即使 matcher 配错，API 也绝不走 locale 逻辑、不缓冲上传体
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

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
     * 仅页面导航写 locale cookie。
     * 必须排除全部 /api/：素材上传、装修上传、BGM 音频等大 body 不能经 middleware 缓冲。
     */
    "/((?!_next/static|_next/image|favicon.ico|brand/|uploads/|api/).*)",
  ],
};
