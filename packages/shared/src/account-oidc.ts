/**
 * 主站作为 account OIDC 客户端。
 *
 * 身份主键只用 ID Token 的 sub（usr_xxx）。
 * 不共享 AUTH_SECRET、密码哈希、数据库或长期 Cookie。
 */

import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export const ACCOUNT_OIDC_TX_COOKIE = "yyds_oidc_tx";
export const ACCOUNT_OIDC_TX_MAX_AGE_SEC = 10 * 60;
export const DEFAULT_ACCOUNT_ISSUER = "https://account.yydsxwh.com";
export const DEFAULT_ACCOUNT_SCOPES =
  "openid profile email phone account.basic";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const FIRST_PARTY_HOSTS = new Set([
  "yydsxwh.com",
  "www.yydsxwh.com",
  "account.yydsxwh.com",
]);

export type AccountOidcConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
};

export type AccountOidcTransaction = {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
  mode: "login" | "register";
};

export type AccountIdClaims = {
  sub: string;
  name: string;
  email: string;
  picture: string;
  preferredUsername: string;
  username: string;
  kkNumber: number | null;
  phone: string;
};

export function normalizeIssuer(raw: string | null | undefined): string {
  return String(raw || "")
    .trim()
    .replace(/\/+$/, "");
}

export function isAccountOidcConfigured(): boolean {
  return readAccountOidcEnv() !== null;
}

export function readAccountOidcEnv(): AccountOidcConfig | null {
  const issuer = normalizeIssuer(
    process.env.ACCOUNT_ISSUER || DEFAULT_ACCOUNT_ISSUER,
  );
  const clientId = (process.env.ACCOUNT_CLIENT_ID || "").trim();
  if (!issuer || !clientId) return null;
  return {
    issuer,
    clientId,
    clientSecret: (process.env.ACCOUNT_CLIENT_SECRET || "").trim(),
    redirectUri: (process.env.ACCOUNT_REDIRECT_URI || "").trim(),
    scopes: (process.env.ACCOUNT_SCOPES || DEFAULT_ACCOUNT_SCOPES).trim(),
  };
}

export function isAllowedCallbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (LOOPBACK_HOSTS.has(host)) return url.protocol === "http:" || url.protocol === "https:";
    if (url.protocol !== "https:") return false;
    return FIRST_PARTY_HOSTS.has(host) || extraAllowedHosts().has(host);
  } catch {
    return false;
  }
}

function extraAllowedHosts(): Set<string> {
  const hosts = new Set<string>();
  const raw = [
    process.env.ACCOUNT_ALLOWED_ORIGINS || "",
    process.env.NEXT_PUBLIC_SITE_URL || "",
    process.env.SITE_URL || "",
    process.env.PUBLIC_BASE_URL || "",
  ].join(",");
  for (const item of raw.split(",")) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    try {
      const withScheme = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
      hosts.add(new URL(withScheme).hostname.toLowerCase());
    } catch {
      // 坏的环境变量不能把校验放宽成任意主机。
    }
  }
  return hosts;
}

export function resolveAccountRedirectUri(input: {
  envRedirectUri?: string;
  requestOrigin?: string;
  publicSiteUrl?: string;
}): string {
  const fromEnv = (input.envRedirectUri || "").trim();
  if (fromEnv) return fromEnv;
  const origin = (input.requestOrigin || input.publicSiteUrl || "").replace(
    /\/+$/,
    "",
  );
  if (origin && isAllowedCallbackOrigin(origin)) {
    return `${origin}/api/auth/callback`;
  }
  const publicOrigin = (
    input.publicSiteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    ""
  ).replace(/\/+$/, "");
  if (publicOrigin) return `${publicOrigin}/api/auth/callback`;
  return "";
}

/**
 * Keep the host that creates the OIDC transaction cookie identical to the
 * callback host. A host-only cookie written on yydsxwh.com is intentionally
 * not sent to www.yydsxwh.com (and vice versa), which otherwise makes the
 * callback look expired on browsers that entered through the alias host.
 */
export function resolveCanonicalAuthStartUrl(input: {
  requestUrl: string;
  requestPublicOrigin: string;
  redirectUri: string;
}): URL | null {
  try {
    const currentOrigin = new URL(input.requestPublicOrigin).origin;
    const callbackOrigin = new URL(input.redirectUri).origin;
    if (!isAllowedCallbackOrigin(callbackOrigin)) return null;
    if (currentOrigin === callbackOrigin) return null;

    const requestUrl = new URL(input.requestUrl);
    return new URL(`${requestUrl.pathname}${requestUrl.search}`, callbackOrigin);
  } catch {
    return null;
  }
}

export function createPkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256")
    .update(verifier, "ascii")
    .digest("base64url");
  return { verifier, challenge };
}

export function createOidcRandoms() {
  return {
    state: randomBytes(16).toString("base64url"),
    nonce: randomBytes(16).toString("base64url"),
    ...createPkcePair(),
  };
}

export function buildAuthorizeUrl(
  config: AccountOidcConfig,
  tx: Pick<AccountOidcTransaction, "state" | "nonce" | "codeVerifier"> & {
    codeChallenge: string;
  },
): URL {
  const authorize = new URL("/api/oauth/authorize", `${config.issuer}/`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", config.redirectUri);
  authorize.searchParams.set("scope", config.scopes);
  authorize.searchParams.set("state", tx.state);
  authorize.searchParams.set("nonce", tx.nonce);
  authorize.searchParams.set("code_challenge", tx.codeChallenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  return authorize;
}

/** 注册必须落到 account 注册页，登完再原样续跑 authorize（保住 PKCE/nonce） */
export function buildAccountRegisterUrl(
  authorizeUrl: URL,
  referralCode = "",
): URL {
  const register = new URL("/register", authorizeUrl.origin);
  register.searchParams.set(
    "next",
    `${authorizeUrl.pathname}${authorizeUrl.search}`,
  );
  if (referralCode.trim()) {
    register.searchParams.set("ref", referralCode.trim().slice(0, 32));
  }
  return register;
}

export function oidcTransactionCookieOptions(maxAge = ACCOUNT_OIDC_TX_MAX_AGE_SEC) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function accountLogoutAction(issuer: string): string {
  return `${normalizeIssuer(issuer)}/api/auth/logout`;
}

export function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildUnifiedLogoutHtml(input: {
  action: string;
  next: string;
}): string {
  const action = escapeHtmlAttr(input.action);
  const next = escapeHtmlAttr(input.next);
  return (
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>正在退出…</title><body style="font-family:system-ui;padding:40px">` +
    `<p>正在退出账号中心…</p>` +
    `<form id="account-logout" action="${action}" method="post">` +
    `<input type="hidden" name="next" value="${next}">` +
    `<button type="submit">继续</button></form>` +
    `<script>document.getElementById("account-logout").submit()</script>` +
    `</body></html>`
  );
}

function readStringClaim(payload: JWTPayload, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value.trim() : "";
}

export function parseKkNumberClaim(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) return raw;
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    const value = Number(raw.trim());
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  return null;
}

/** 只接受 account 的 usr_* public id，拒绝把邮箱/用户名当主键 */
export function parseAccountSub(raw: unknown): string | null {
  const value = String(raw || "").trim();
  if (!/^usr_[0-9A-HJKMNP-TV-Z]{26}$/.test(value)) return null;
  return value;
}

export function readAccountIdClaims(payload: JWTPayload): AccountIdClaims | null {
  const sub = parseAccountSub(payload.sub);
  if (!sub) return null;
  return {
    sub,
    name: readStringClaim(payload, "name") || readStringClaim(payload, "nickname"),
    email: readStringClaim(payload, "email").toLowerCase(),
    picture: readStringClaim(payload, "picture"),
    preferredUsername: readStringClaim(payload, "preferred_username"),
    username: readStringClaim(payload, "username"),
    kkNumber: parseKkNumberClaim(payload.kk_number),
    phone: readStringClaim(payload, "phone_number"),
  };
}

export async function exchangeAuthorizationCode(input: {
  config: AccountOidcConfig;
  code: string;
  codeVerifier: string;
}): Promise<{ idToken: string; accessToken: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.config.redirectUri,
    client_id: input.config.clientId,
    code_verifier: input.codeVerifier,
  });
  if (input.config.clientSecret) {
    body.set("client_secret", input.config.clientSecret);
  }

  const res = await fetch(`${input.config.issuer}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as {
    error?: string;
    error_description?: string;
    id_token?: string;
    access_token?: string;
  };
  if (!res.ok || !data.id_token) {
    throw new Error(data.error_description || data.error || "换票失败");
  }
  return {
    idToken: data.id_token,
    accessToken: data.access_token || "",
  };
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksForIssuer(issuer: string) {
  const key = normalizeIssuer(issuer);
  const cached = jwksCache.get(key);
  if (cached) return cached;
  const jwks = createRemoteJWKSet(new URL("/.well-known/jwks.json", `${key}/`));
  jwksCache.set(key, jwks);
  return jwks;
}

export async function verifyAccountIdToken(input: {
  token: string;
  issuer: string;
  audience: string;
  nonce: string;
}): Promise<JWTPayload> {
  const { payload } = await jwtVerify(input.token, jwksForIssuer(input.issuer), {
    issuer: normalizeIssuer(input.issuer),
    audience: input.audience,
    algorithms: ["RS256"],
  });
  if (payload.nonce !== input.nonce) {
    throw new Error("nonce mismatch");
  }
  return payload;
}
