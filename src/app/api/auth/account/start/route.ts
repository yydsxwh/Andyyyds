/**
 * GET /api/auth/account/start?mode=login|register&next=/path
 *
 * 主站登录/注册入口：签发 PKCE 事务 Cookie，再跳到 account 的
 * Authorization Code 或注册页（next 指向 authorize，保住 PKCE）。
 */

import { NextResponse } from "next/server";
import {
  buildAccountRegisterUrl,
  buildAuthorizeUrl,
  createOidcRandoms,
  readAccountOidcEnv,
  resolveCanonicalAuthStartUrl,
  resolveAccountRedirectUri,
} from "@andyyyds/shared/account-oidc";
import {
  ACCOUNT_OIDC_TX_COOKIE,
  oidcTransactionCookieOptions,
  signAccountOidcTransaction,
} from "@andyyyds/shared/account-oidc-cookie";
import { getPublicSiteUrl } from "@andyyyds/shared/payments";
import { getRequestPublicOrigin } from "@andyyyds/shared/request-origin";
import { safeNextPath } from "@andyyyds/shared/safe-next-path";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const env = readAccountOidcEnv();
  const mode = url.searchParams.get("mode") === "register" ? "register" : "login";
  const returnTo = safeNextPath(url.searchParams.get("next"));

  if (!env) {
    const fallback = mode === "register" ? "/register" : "/login";
    return NextResponse.redirect(new URL(fallback, url.origin));
  }

  const publicSiteUrl = await getPublicSiteUrl();
  const requestPublicOrigin = getRequestPublicOrigin(req) || url.origin;
  const redirectUri = resolveAccountRedirectUri({
    envRedirectUri: env.redirectUri,
    requestOrigin: requestPublicOrigin,
    publicSiteUrl,
  });
  const canonicalStartUrl = resolveCanonicalAuthStartUrl({
    requestUrl: url.toString(),
    requestPublicOrigin,
    redirectUri,
  });
  if (canonicalStartUrl) {
    const res = NextResponse.redirect(canonicalStartUrl, { status: 307 });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  const config = { ...env, redirectUri };
  const randoms = createOidcRandoms();
  const authorize = buildAuthorizeUrl(config, {
    state: randoms.state,
    nonce: randoms.nonce,
    codeVerifier: randoms.verifier,
    codeChallenge: randoms.challenge,
  });
  const referralCode = (url.searchParams.get("ref") || "").trim();
  const dest =
    mode === "register"
      ? buildAccountRegisterUrl(authorize, referralCode)
      : authorize;

  const token = await signAccountOidcTransaction({
    state: randoms.state,
    nonce: randoms.nonce,
    codeVerifier: randoms.verifier,
    returnTo,
    mode,
  });

  const res = NextResponse.redirect(dest.toString());
  res.cookies.set(
    ACCOUNT_OIDC_TX_COOKIE,
    token,
    oidcTransactionCookieOptions(),
  );
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
