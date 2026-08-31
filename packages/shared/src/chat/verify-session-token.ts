/**
 * 供 WebSocket 等非 Next cookies() 场景校验登录 JWT。
 * 与 auth.ts 的 Cookie 名 / 算法保持一致。
 */
import { jwtVerify } from "jose";

export const CHAT_SESSION_COOKIE = "yyds_session";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is missing");
  return new TextEncoder().encode(secret);
}

export async function verifySessionToken(
  token: string | undefined | null,
): Promise<{ id: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const id = String(payload.id || "");
    if (!id) return null;
    return { id };
  } catch {
    return null;
  }
}

export function parseCookieHeader(
  cookieHeader: string | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
