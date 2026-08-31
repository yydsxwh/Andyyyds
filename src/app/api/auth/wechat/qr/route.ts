/**
 * GET /api/auth/wechat/qr?returnUrl=/&purpose=login&requestedRole=STUDENT
 *
 * 微信开放平台「网站应用」扫码登录入口（PC / 普通浏览器）。
 * 跳转 qrconnect，用户用微信扫一扫确认后回到 /api/auth/wechat/callback。
 *
 * 与公众号网页授权（/api/auth/wechat）互不踩：
 * - 微信内请走公众号授权（拿公众号 openid，便于 JSAPI 支付）
 * - 站外浏览器走本入口（网站应用 openid 存 wechatWebOpenId）
 *
 * 前置：系统设置或环境变量已填网站应用 AppID + AppSecret；
 * 开放平台已配置授权回调域（如 www.yydsxwh.com）。
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { getPublicSiteUrl } from "@andyyyds/shared/payments";
import { APPLYABLE_ROLES } from "@andyyyds/shared/roles";
import { getWechatWebOAuthConfig } from "@andyyyds/shared/wechat-pay";
import {
  safeReturnUrl,
  signWechatOAuthState,
  type WechatOAuthPurpose,
} from "@andyyyds/shared/wechat-oauth-state";

export async function GET(req: Request) {
  const oauth = await getWechatWebOAuthConfig();
  if (!oauth) {
    return NextResponse.json(
      {
        error:
          "未配置开放平台网站应用。请在系统设置填写「网站应用 AppID / AppSecret」，并在微信开放平台配置授权回调域。",
      },
      { status: 400 },
    );
  }

  const url = new URL(req.url);
  const purposeRaw = (url.searchParams.get("purpose") || "login").toLowerCase();
  // 扫码登录以 login 为主；bind 仅在已登录且需关联网站应用身份时使用
  const purpose: WechatOAuthPurpose =
    purposeRaw === "bind" ? "bind" : "login";
  const returnUrl = safeReturnUrl(
    url.searchParams.get("returnUrl"),
    purpose === "login" ? "/" : "/account",
  );

  const session = await getSession();
  if (purpose === "bind" && !session) {
    return NextResponse.json(
      { error: "请先登录后再绑定微信扫码身份" },
      { status: 401 },
    );
  }

  const requestedRoleRaw = (url.searchParams.get("requestedRole") || "").trim();
  const requestedRole =
    purpose === "login" &&
    (APPLYABLE_ROLES as readonly string[]).includes(requestedRoleRaw)
      ? requestedRoleRaw
      : "";
  const referralCode =
    purpose === "login"
      ? (url.searchParams.get("referralCode") || "").trim().slice(0, 32)
      : "";

  const state = await signWechatOAuthState({
    returnUrl,
    userId: session?.id,
    purpose,
    channel: "web",
    requestedRole: requestedRole || undefined,
    referralCode: referralCode || undefined,
  });

  const siteUrl = await getPublicSiteUrl();
  const redirectUri = `${siteUrl}/api/auth/wechat/callback`;
  // 开放平台网站应用扫码：qrconnect + snsapi_login（非公众号 oauth2/authorize）
  const authorize = new URL(
    "https://open.weixin.qq.com/connect/qrconnect",
  );
  authorize.searchParams.set("appid", oauth.appId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "snsapi_login");
  authorize.searchParams.set("state", state);
  authorize.hash = "wechat_redirect";

  return NextResponse.redirect(authorize.toString());
}
