import { NextResponse } from "next/server";
import { destroySession } from "@andyyyds/shared/auth";
import { getPublicSiteUrl } from "@andyyyds/shared/payments";
import { getRequestPublicOrigin } from "@andyyyds/shared/request-origin";

/**
 * 退出登录：清会话 Cookie，再 303 回首页。
 * 游客可继续逛公开页；跳转必须用浏览器同源 / 配置的公网站点，禁止落到反代后的 localhost。
 */
export async function POST(req: Request) {
  await destroySession();

  const origin =
    getRequestPublicOrigin(req) || (await getPublicSiteUrl());
  return NextResponse.redirect(new URL("/", origin), { status: 303 });
}
