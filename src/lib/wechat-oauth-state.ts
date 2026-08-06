/**
 * 微信网页授权的 state 防伪
 *
 * 流程：发起授权时把 returnUrl / userId 签成短期 JWT → 回调时校验 →
 * 再跳回站内路径。避免伪造回调或开放重定向。
 */

import { SignJWT, jwtVerify } from "jose";

export type WechatOAuthState = {
  /** 授权成功后跳回的站内路径，如 /checkout/xxx */
  returnUrl: string;
  /** 发起授权时的登录用户；回调时写入其 wechatOpenId */
  userId?: string;
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
    return {
      returnUrl,
      userId: payload.userId ? String(payload.userId) : undefined,
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
