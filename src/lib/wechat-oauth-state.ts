/**
 * 微信 OAuth 的 state 防伪
 *
 * 流程：发起授权时把 returnUrl / userId / purpose / 渠道 签成短期 JWT →
 * 回调时校验 → 再跳回站内路径。避免伪造回调或开放重定向。
 *
 * purpose=login：微信登录/注册（可未登录；新建时可带 requestedRole）
 * purpose=bind：给已登录用户写 openid（支付 JSAPI，仅公众号渠道）
 *
 * channel=oa：公众号网页授权（微信内 snsapi_base/userinfo）
 * channel=web：开放平台网站应用扫码（qrconnect + snsapi_login）
 */

import { SignJWT, jwtVerify } from "jose";

export type WechatOAuthPurpose = "login" | "bind";
/** oa=公众号网页授权；web=开放平台网站应用扫码 */
export type WechatOAuthChannel = "oa" | "web";

export type WechatOAuthState = {
  /** 授权成功后跳回的站内路径，如 /checkout/xxx 或 / */
  returnUrl: string;
  /** 发起授权时的登录用户；bind 时写入其 wechatOpenId */
  userId?: string;
  /** login = 微信登录/注册；bind = 仅绑定 openid（默认，兼容支付） */
  purpose?: WechatOAuthPurpose;
  /** 授权渠道：决定用哪套 AppID/Secret 换 code，以及 openid 写入哪个字段 */
  channel?: WechatOAuthChannel;
  /** 仅新建微信用户时写入；已有账号忽略 */
  requestedRole?: string;
  referralCode?: string;
  /**
   * 登录是否强制拉昵称头像（snsapi_userinfo）。
   * 老用户用静默 base；仅首次建号前再升到 userinfo。
   * 扫码登录（web）始终可拉资料，此字段可忽略。
   */
  forceUserInfo?: boolean;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is missing");
  return new TextEncoder().encode(secret);
}

/** 生成授权 state（约 15 分钟有效） */
export async function signWechatOAuthState(payload: WechatOAuthState) {
  return new SignJWT({
    returnUrl: payload.returnUrl,
    userId: payload.userId || "",
    purpose: payload.purpose || "bind",
    channel: payload.channel || "oa",
    requestedRole: payload.requestedRole || "",
    referralCode: payload.referralCode || "",
    forceUserInfo: payload.forceUserInfo ? "1" : "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getSecret());
}

/** 校验 state；失败返回 null */
export async function verifyWechatOAuthState(
  token: string,
): Promise<WechatOAuthState | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const returnUrl = String(payload.returnUrl || "");
    // 只接受站内相对路径
    if (!returnUrl.startsWith("/")) return null;
    const purposeRaw = String(payload.purpose || "bind");
    const purpose: WechatOAuthPurpose =
      purposeRaw === "login" ? "login" : "bind";
    const channelRaw = String(payload.channel || "oa");
    const channel: WechatOAuthChannel =
      channelRaw === "web" ? "web" : "oa";
    return {
      returnUrl,
      userId: payload.userId ? String(payload.userId) : undefined,
      purpose,
      channel,
      requestedRole: payload.requestedRole
        ? String(payload.requestedRole)
        : undefined,
      referralCode: payload.referralCode
        ? String(payload.referralCode)
        : undefined,
      forceUserInfo: String(payload.forceUserInfo || "") === "1",
    };
  } catch {
    return null;
  }
}

/** 仅允许站内相对路径，防止开放重定向攻击 */
export function safeReturnUrl(raw: string | null | undefined, fallback = "/") {
  const value = (raw || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("://")) return fallback;
  return value.slice(0, 500) || fallback;
}
