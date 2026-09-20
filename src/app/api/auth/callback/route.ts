/**
 * GET /api/auth/callback
 * account OIDC Authorization Code 回调。校验 state / nonce / PKCE 后，
 * 用 sub=usr_xxx 挂钩本地业务用户并建立主站自己的 Session。
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { upsertLocalUserFromAccount } from "@andyyyds/shared/account-identity";
import {
  exchangeAuthorizationCode,
  readAccountIdClaims,
  readAccountOidcEnv,
  resolveAccountRedirectUri,
  verifyAccountIdToken,
} from "@andyyyds/shared/account-oidc";
import {
  ACCOUNT_OIDC_TX_COOKIE,
  oidcTransactionCookieOptions,
  verifyAccountOidcTransaction,
} from "@andyyyds/shared/account-oidc-cookie";
import { createSession } from "@andyyyds/shared/auth";
import { getPublicSiteUrl } from "@andyyyds/shared/payments";
import { getRequestPublicOrigin } from "@andyyyds/shared/request-origin";
import { safeNextPath } from "@andyyyds/shared/safe-next-path";
import type { Role } from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

function failRedirect(origin: string, message: string) {
  const dest = new URL("/login", origin);
  dest.searchParams.set("error", message);
  return NextResponse.redirect(dest);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin =
    getRequestPublicOrigin(req) || (await getPublicSiteUrl()) || url.origin;
  const env = readAccountOidcEnv();
  if (!env) {
    return failRedirect(origin, "账号中心未配置");
  }

  const code = (url.searchParams.get("code") || "").trim();
  const state = (url.searchParams.get("state") || "").trim();
  const oauthError = (url.searchParams.get("error") || "").trim();
  if (oauthError) {
    return failRedirect(origin, "账号中心拒绝了登录");
  }

  const jar = await cookies();
  const tx = await verifyAccountOidcTransaction(
    jar.get(ACCOUNT_OIDC_TX_COOKIE)?.value,
  );
  if (!tx || !code || !state || tx.state !== state) {
    return failRedirect(origin, "登录已过期，请重试");
  }

  const redirectUri = resolveAccountRedirectUri({
    envRedirectUri: env.redirectUri,
    requestOrigin: origin,
    publicSiteUrl: await getPublicSiteUrl(),
  });
  const config = { ...env, redirectUri };

  try {
    const tokens = await exchangeAuthorizationCode({
      config,
      code,
      codeVerifier: tx.codeVerifier,
    });
    const payload = await verifyAccountIdToken({
      token: tokens.idToken,
      issuer: config.issuer,
      audience: config.clientId,
      nonce: tx.nonce,
    });
    const claims = readAccountIdClaims(payload);
    if (!claims) {
      return failRedirect(origin, "账号中心未返回有效身份");
    }

    const user = await upsertLocalUserFromAccount(claims);
    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    });
  } catch (error) {
    console.error("[auth/callback]", error);
    return failRedirect(origin, "登录失败，请重试");
  }

  const res = NextResponse.redirect(new URL(safeNextPath(tx.returnTo), origin));
  res.cookies.set(ACCOUNT_OIDC_TX_COOKIE, "", {
    ...oidcTransactionCookieOptions(0),
    maxAge: 0,
  });
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
