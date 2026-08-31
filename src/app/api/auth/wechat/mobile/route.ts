/**
 * POST /api/auth/wechat/mobile
 * body: { code, purpose?, returnUrl?, requestedRole?, referralCode? }
 *
 * Android App 微信 SDK 快捷登录：原生拿到 OAuth code 后换 openid，
 * 写入 wechatMobileOpenId；与公众号/网站扫码分字段，避免污染 JSAPI。
 * 会话 Cookie 与邮箱/手机号登录一致（createSession → yyds_session）。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import {
  bindWechatToUser,
  findOrCreateUserByWechat,
} from "@andyyyds/shared/auth-providers";
import { APPLYABLE_ROLES } from "@andyyyds/shared/roles";
import {
  exchangeWechatOAuthCode,
  fetchWechatUserInfo,
} from "@andyyyds/shared/wechat-pay";
import { safeReturnUrl } from "@andyyyds/shared/wechat-oauth-state";

const schema = z.object({
  code: z.string().min(1).max(256),
  purpose: z.enum(["login", "bind"]).optional().default("login"),
  returnUrl: z.string().max(500).optional(),
  requestedRole: z.enum(APPLYABLE_ROLES).optional(),
  referralCode: z.string().max(32).optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const code = body.code.trim();
    const purpose = body.purpose;
    const returnUrl = safeReturnUrl(body.returnUrl, "/account");

    const token = await exchangeWechatOAuthCode(code, "mobile");
    if (!token.openid) {
      return NextResponse.json({ error: "未取得微信 openid" }, { status: 400 });
    }

    let nickname = "";
    let headimgurl = "";
    // 移动应用 snsapi_userinfo 通常可拉资料；失败不阻断登录
    if (token.accessToken) {
      try {
        const profile = await fetchWechatUserInfo({
          accessToken: token.accessToken,
          openid: token.openid,
        });
        nickname = profile.nickname;
        headimgurl = profile.headimgurl;
      } catch {
        /* 资料可选 */
      }
    }

    if (purpose === "bind") {
      const session = await getSession();
      if (!session?.id) {
        return NextResponse.json(
          { error: "绑定微信需要先登录" },
          { status: 401 },
        );
      }
      await bindWechatToUser({
        userId: session.id,
        openid: token.openid,
        unionid: token.unionid,
        channel: "mobile",
        nickname,
        headimgurl,
      });
      return NextResponse.json({ ok: true, redirect: returnUrl });
    }

    const { isNewUser, result } = await findOrCreateUserByWechat({
      openid: token.openid,
      unionid: token.unionid,
      channel: "mobile",
      referralCode: body.referralCode,
      requestedRole: body.requestedRole,
      nickname,
      headimgurl,
    });

    const redirect = result.pendingReview ? "/account?pending=1" : returnUrl;
    return NextResponse.json({
      ...result,
      isNewUser,
      redirect,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "微信登录失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
