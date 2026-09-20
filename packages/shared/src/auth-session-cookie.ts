/**
 * 主站 Session Cookie 的唯一配置来源。
 * 登录写入与登出清除必须走这里，避免 path / secure / sameSite 不一致导致删不掉。
 */

export const SESSION_COOKIE_NAME = "yyds_session";
export const SESSION_COOKIE_PATH = "/";
export const SESSION_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30;
export const SESSION_COOKIE_SAME_SITE = "lax" as const;

export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: typeof SESSION_COOKIE_SAME_SITE;
  secure: boolean;
  path: typeof SESSION_COOKIE_PATH;
  maxAge: number;
  expires?: Date;
};

/** 与创建 Cookie 时一致：生产 HTTPS 才带 Secure；不设 domain，跟浏览器当前主机走 */
export function sessionCookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

export function sessionCookieWriteOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: SESSION_COOKIE_SAME_SITE,
    secure: sessionCookieSecure(),
    path: SESSION_COOKIE_PATH,
    maxAge: SESSION_COOKIE_MAX_AGE_SEC,
  };
}

/** 删除必须复用同一 path / secure / sameSite，并显式过期 */
export function sessionCookieClearOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: SESSION_COOKIE_SAME_SITE,
    secure: sessionCookieSecure(),
    path: SESSION_COOKIE_PATH,
    maxAge: 0,
    expires: new Date(0),
  };
}

type CookieSetter = {
  set: (
    name: string,
    value: string,
    options?: SessionCookieOptions,
  ) => unknown;
};

export function applySessionCookie(target: CookieSetter, token: string) {
  target.set(SESSION_COOKIE_NAME, token, sessionCookieWriteOptions());
}

export function clearSessionCookie(target: CookieSetter) {
  target.set(SESSION_COOKIE_NAME, "", sessionCookieClearOptions());
}

/** JWT.sv 与用户 sessionEpoch 对不上则视为已登出（防旧 Cookie 重放） */
export function isSessionEpochValid(
  tokenEpoch: unknown,
  userEpoch: number | null | undefined,
): boolean {
  const tokenSv = Number(tokenEpoch ?? 0);
  const userSv = Number(userEpoch ?? 0);
  if (!Number.isFinite(tokenSv) || !Number.isFinite(userSv)) return false;
  return tokenSv === userSv;
}
