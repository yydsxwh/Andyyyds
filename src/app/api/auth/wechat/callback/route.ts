/**
 * GET /api/auth/wechat/callback
 *
 * 微信 OAuth 回调（公众号网页授权 + 开放平台扫码共用）：
 * - channel=oa + purpose=login：先静默拿公众号 openid；老用户直接登录；
 *   新用户再跳一次 snsapi_userinfo 申请头像昵称后建号。
 * - channel=web + purpose=login：网站应用扫码；用网站应用凭证换 token，
 *   openid 写入 wechatWebOpenId；有 unionid 则与公众号用户合并。
 * - purpose=bind：写入当前用户对应渠道的 openid（oa 供 JSAPI）
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  bindWechatToUser,
  findOrCreateUserByWechat,
  findUserByWechatIdentity,
} from "@/lib/auth-providers";
import { getPublicSiteUrl } from "@/lib/payments";
import {
  exchangeWechatOAuthCode,
  fetchWechatUserInfo,
  getWechatOAuthConfig,
} from "@/lib/wechat-pay";
import {
  safeReturnUrl,
  signWechatOAuthState,
  verifyWechatOAuthState,
  type WechatOAuthChannel,
} from "@/lib/wechat-oauth-state";

function withQuery(path: string, params: Record<string, string>) {
  const u = new URL(path, "https://placeholder.local");
  for (const [k, v] of Object.entries(params)) {
    u.searchParams.set(k, v);
  }
  return `${u.pathname}${u.search}`;
}

export async function GET(req: Request) {
  const siteUrl = await getPublicSiteUrl();
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const stateToken = url.searchParams.get("state") || "";
  const state = stateToken ? await verifyWechatOAuthState(stateToken) : null;
  const returnUrl = safeReturnUrl(state?.returnUrl, "/");
  const purpose = state?.purpose || "bind";
  const channel: WechatOAuthChannel = state?.channel || "oa";

  if (!code) {
    return NextResponse.redirect(
      `${siteUrl}${withQuery(returnUrl, { wechat_oauth: "denied" })}`,
    );
  }

  try {
    // 必须用发起授权时的同一套 AppID/Secret 换 code，否则会失败
    const token = await exchangeWechatOAuthCode(code, channel);
    if (!token.openid) {
      throw new Error("未取得微信 openid");
    }

    let nickname = "";
    let headimgurl = "";
    const scope = token.scope || "";
    // 扫码 snsapi_login 与公众号 snsapi_userinfo 均可拉昵称头像
    const hasUserInfoScope =
      channel === "web" ||
      scope.includes("snsapi_userinfo") ||
      scope.includes("snsapi_login") ||
      Boolean(state?.forceUserInfo);

    if (token.accessToken && hasUserInfoScope) {
      try {
        const profile = await fetchWechatUserInfo({
          accessToken: token.accessToken,
          openid: token.openid,
        });
        nickname = profile.nickname;
        headimgurl = profile.headimgurl;
      } catch {
        // 资料拉取失败不阻断；建号时用「微信用户」占位
      }
    }

    if (purpose === "login") {
      const existing = await findUserByWechatIdentity({
        openid: token.openid,
        unionid: token.unionid,
        channel,
      });

      // 公众号老用户：静默登录即可，不再弹头像昵称授权
      if (existing && channel === "oa" && !state?.forceUserInfo) {
        const { result } = await findOrCreateUserByWechat({
          openid: token.openid,
          unionid: token.unionid,
          channel,
        });
        const flags: Record<string, string> = { wechat_login: "ok" };
        if (result.pendingReview) flags.pending = "1";
        const dest = result.pendingReview
          ? withQuery("/account", { ...flags, pending: "1" })
          : withQuery(returnUrl, flags);
        return NextResponse.redirect(`${siteUrl}${dest}`);
      }

      // 公众号新用户且尚未做 userinfo：再跳微信申请头像昵称（仅此一次）
      if (!existing && channel === "oa" && !hasUserInfoScope) {
        const oauth = await getWechatOAuthConfig();
        if (!oauth) throw new Error("微信登录未配置");
        const nextState = await signWechatOAuthState({
          returnUrl,
          purpose: "login",
          channel: "oa",
          requestedRole: state?.requestedRole,
          referralCode: state?.referralCode,
          forceUserInfo: true,
        });
        const authorize = new URL(
          "https://open.weixin.qq.com/connect/oauth2/authorize",
        );
        authorize.searchParams.set("appid", oauth.appId);
        authorize.searchParams.set(
          "redirect_uri",
          `${siteUrl}/api/auth/wechat/callback`,
        );
        authorize.searchParams.set("response_type", "code");
        authorize.searchParams.set("scope", "snsapi_userinfo");
        authorize.searchParams.set("state", nextState);
        authorize.hash = "wechat_redirect";
        return NextResponse.redirect(authorize.toString());
      }

      const { isNewUser, result } = await findOrCreateUserByWechat({
        openid: token.openid,
        unionid: token.unionid,
        channel,
        referralCode: state?.referralCode,
        requestedRole: state?.requestedRole,
        nickname,
        headimgurl,
      });
      const flags: Record<string, string> = { wechat_login: "ok" };
      if (isNewUser) flags.wechat_new = "1";
      if (result.pendingReview) flags.pending = "1";
      const dest = result.pendingReview
        ? withQuery("/account", { ...flags, pending: "1" })
        : withQuery(returnUrl, flags);
      return NextResponse.redirect(`${siteUrl}${dest}`);
    }

    // 绑定：优先当前会话，否则用 state 里记下的 userId
    const session = await getSession();
    const userId = session?.id || state?.userId;
    if (!userId) {
      throw new Error("绑定微信需要先登录");
    }
    await bindWechatToUser({
      userId,
      openid: token.openid,
      unionid: token.unionid,
      channel,
      nickname,
      headimgurl,
    });
    return NextResponse.redirect(
      `${siteUrl}${withQuery(returnUrl, { wechat_oauth: "ok" })}`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "oauth_fail";
    const flag = purpose === "login" ? "wechat_login" : "wechat_oauth";
    return NextResponse.redirect(
      `${siteUrl}${withQuery(returnUrl, {
        [flag]: "error",
        msg: message.slice(0, 120),
      })}`,
    );
  }
}
