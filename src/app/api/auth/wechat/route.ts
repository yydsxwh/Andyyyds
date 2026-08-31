/**
 * GET /api/auth/wechat?returnUrl=/&purpose=login&requestedRole=STUDENT
 *
 * 微信公众号网页授权入口。
 * - purpose=login：默认 snsapi_base 静默拿 openid；仅首次建号前用 forceUserInfo=1 升到
 *   snsapi_userinfo（申请头像昵称）。老用户不再弹授权页，也不强制进个人中心改资料。
 * - purpose=bind：snsapi_base，静默绑定 openid（JSAPI 支付）
 *
 * 前置：系统设置已填 AppID + AppSecret；公众号已配网页授权域名。
 * 须在微信内置浏览器中打开。
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { getPublicSiteUrl } from "@andyyyds/shared/payments";
import { APPLYABLE_ROLES } from "@andyyyds/shared/roles";
import { getWechatOAuthConfig } from "@andyyyds/shared/wechat-pay";
import {
  safeReturnUrl,
  signWechatOAuthState,
  type WechatOAuthPurpose,
} from "@andyyyds/shared/wechat-oauth-state";

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
  // 登录默认回首页；支付绑定等仍可由调用方指定 returnUrl
  const returnUrl = safeReturnUrl(
    url.searchParams.get("returnUrl"),
    purposeDefaultReturn(url.searchParams.get("purpose")),
  );
  const purposeRaw = (url.searchParams.get("purpose") || "bind").toLowerCase();
  const purpose: WechatOAuthPurpose =
    purposeRaw === "login" ? "login" : "bind";
  const session = await getSession();

  if (purpose === "bind" && !session) {
    return NextResponse.json(
      { error: "请先登录后再绑定微信" },
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

  // 仅「确认是新用户、需要建号」时由 callback 再带 forceUserInfo=1 进来
  const forceUserInfo =
    purpose === "login" &&
    ["1", "true", "yes"].includes(
      (url.searchParams.get("forceUserInfo") || "").toLowerCase(),
    );

  const state = await signWechatOAuthState({
    returnUrl,
    userId: session?.id,
    purpose,
    // 公众号网页授权渠道；与开放平台扫码（channel=web）分开换 token / 存 openid
    channel: "oa",
    requestedRole: requestedRole || undefined,
    referralCode: referralCode || undefined,
    forceUserInfo,
  });

  const siteUrl = await getPublicSiteUrl();
  const redirectUri = `${siteUrl}/api/auth/wechat/callback`;
  const authorize = new URL(
    "https://open.weixin.qq.com/connect/oauth2/authorize",
  );
  authorize.searchParams.set("appid", oauth.appId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_type", "code");
  // 老用户静默；仅首次建号申请头像昵称
  authorize.searchParams.set(
    "scope",
    purpose === "login" && forceUserInfo ? "snsapi_userinfo" : "snsapi_base",
  );
  authorize.searchParams.set("state", state);
  authorize.hash = "wechat_redirect";

  return NextResponse.redirect(authorize.toString());
}

function purposeDefaultReturn(purpose: string | null) {
  return (purpose || "").toLowerCase() === "login" ? "/" : "/account";
}
