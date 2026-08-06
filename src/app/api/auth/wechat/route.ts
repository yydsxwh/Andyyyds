/**
 * GET /api/auth/wechat?returnUrl=/checkout/xxx
 *
 * 微信公众号网页授权入口（snsapi_base，静默拿 openid）。
 * 前置：系统设置已填 AppID + AppSecret；公众号已配网页授权域名。
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPublicSiteUrl } from "@/lib/payments";
import { getWechatOAuthConfig } from "@/lib/wechat-pay";
import {
  safeReturnUrl,
  signWechatOAuthState,
} from "@/lib/wechat-oauth-state";

export async function GET(req: Request) {
  const oauth = await getWechatOAuthConfig();
  if (!oauth) {
    return NextResponse.json(
      {
        error:
          "未配置微信 AppSecret。请在系统设置填写公众号 AppSecret，并在公众号后台配置网页授权域名。",
      },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const returnUrl = safeReturnUrl(url.searchParams.get("returnUrl"), "/");
  const session = await getSession();
  // state 里带上用户与回跳地址，回调时校验防伪造
  const state = await signWechatOAuthState({
    returnUrl,
    userId: session?.id,
  });

  const siteUrl = await getPublicSiteUrl();
  const redirectUri = `${siteUrl}/api/auth/wechat/callback`;
  const authorize = new URL(
    "https://open.weixin.qq.com/connect/oauth2/authorize",
  );
  authorize.searchParams.set("appid", oauth.appId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "snsapi_base");
  authorize.searchParams.set("state", state);
  authorize.hash = "wechat_redirect";

  return NextResponse.redirect(authorize.toString());
}
