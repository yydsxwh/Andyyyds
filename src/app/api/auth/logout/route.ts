import { NextResponse } from "next/server";
import { destroySession } from "@andyyyds/shared/auth";
import { clearSessionCookie } from "@andyyyds/shared/auth-session-cookie";
import { getPublicSiteUrl } from "@andyyyds/shared/payments";
import { getRequestPublicOrigin } from "@andyyyds/shared/request-origin";

export const dynamic = "force-dynamic";

/**
 * 退出登录：先作废服务端 sessionEpoch，再在 303 响应上按登录时同一套属性清 Cookie。
 * 必须把清 Cookie 写在返回的 NextResponse 上；只调 cookies().delete() 再 redirect
 * 时，Set-Cookie 经常不会出现在 303 上，浏览器会继续带着 yyds_session。
 */
export async function POST(req: Request) {
  await destroySession();

  const origin =
    getRequestPublicOrigin(req) || (await getPublicSiteUrl());
  const res = NextResponse.redirect(new URL("/", origin), { status: 303 });
  clearSessionCookie(res.cookies);
  res.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );
  return res;
}
