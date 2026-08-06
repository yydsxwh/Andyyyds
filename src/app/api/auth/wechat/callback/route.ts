/**
 * GET /api/auth/wechat/callback
 *
 * 微信 OAuth 回调：用 code 换 openid，写入当前用户，再跳回业务页。
 * 成功后结账页会再次发起 JSAPI 支付。
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPublicSiteUrl } from "@/lib/payments";
import { exchangeWechatOAuthCode } from "@/lib/wechat-pay";
import {
  safeReturnUrl,
  verifyWechatOAuthState,
} from "@/lib/wechat-oauth-state";

export async function GET(req: Request) {
  const siteUrl = await getPublicSiteUrl();
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const stateToken = url.searchParams.get("state") || "";
  const state = stateToken ? await verifyWechatOAuthState(stateToken) : null;
  const returnUrl = safeReturnUrl(state?.returnUrl, "/");

  if (!code) {
    return NextResponse.redirect(
      `${siteUrl}${returnUrl}${returnUrl.includes("?") ? "&" : "?"}wechat_oauth=denied`,
    );
  }

  try {
    const { openid } = await exchangeWechatOAuthCode(code);
    const session = await getSession();
    // 优先当前登录用户；否则用 state 里记下的 userId
    const userId = session?.id || state?.userId;
    if (userId && openid) {
      await prisma.user.update({
        where: { id: userId },
        data: { wechatOpenId: openid },
      });
    }
    const sep = returnUrl.includes("?") ? "&" : "?";
    return NextResponse.redirect(
      `${siteUrl}${returnUrl}${sep}wechat_oauth=ok`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? encodeURIComponent(error.message) : "oauth_fail";
    const sep = returnUrl.includes("?") ? "&" : "?";
    return NextResponse.redirect(
      `${siteUrl}${returnUrl}${sep}wechat_oauth=error&msg=${message}`,
    );
  }
}
