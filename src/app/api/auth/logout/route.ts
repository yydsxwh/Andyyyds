/**
 * POST /api/auth/logout
 *
 * 先清主站 Session，再自动 POST 到 account 退出，避免主站看起来已退出、
 * 再点登录却因 account 会话还在而静默恢复。
 * 未配置 OIDC 时只清主站（旧兼容）。
 */

import { NextResponse } from "next/server";
import {
  accountLogoutAction,
  readAccountOidcEnv,
} from "@andyyyds/shared/account-oidc";
import { destroySession } from "@andyyyds/shared/auth";
import { clearSessionCookie } from "@andyyyds/shared/auth-session-cookie";
import { getPublicSiteUrl } from "@andyyyds/shared/payments";
import { getRequestPublicOrigin } from "@andyyyds/shared/request-origin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await destroySession();

  const origin =
    getRequestPublicOrigin(req) || (await getPublicSiteUrl());
  const env = readAccountOidcEnv();

  if (env) {
    // 顶层 GET 到 account，SameSite=Lax 才会带上账号中心 Cookie
    const dest = new URL(accountLogoutAction(env.issuer));
    dest.searchParams.set("next", origin.endsWith("/") ? origin : `${origin}/`);
    const res = NextResponse.redirect(dest, { status: 303 });
    clearSessionCookie(res.cookies);
    res.headers.set(
      "Cache-Control",
      "private, no-store, no-cache, must-revalidate",
    );
    return res;
  }

  const res = NextResponse.redirect(new URL("/", origin), { status: 303 });
  clearSessionCookie(res.cookies);
  res.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );
  return res;
}
