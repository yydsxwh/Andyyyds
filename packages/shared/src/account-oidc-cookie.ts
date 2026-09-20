/**
 * OIDC 事务 Cookie：把 state / nonce / PKCE verifier / returnTo 签进主站自己的
 * AUTH_SECRET。这是主站密钥，不是 account 的，也不能发到浏览器 JS。
 */

import { SignJWT, jwtVerify } from "jose";
import {
  ACCOUNT_OIDC_TX_COOKIE,
  ACCOUNT_OIDC_TX_MAX_AGE_SEC,
  oidcTransactionCookieOptions,
  type AccountOidcTransaction,
} from "./account-oidc";
import { safeNextPath } from "./safe-next-path";

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is missing");
  return new TextEncoder().encode(secret);
}

export async function signAccountOidcTransaction(
  tx: AccountOidcTransaction,
): Promise<string> {
  return new SignJWT({
    state: tx.state,
    nonce: tx.nonce,
    cv: tx.codeVerifier,
    returnTo: safeNextPath(tx.returnTo),
    mode: tx.mode === "register" ? "register" : "login",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCOUNT_OIDC_TX_MAX_AGE_SEC}s`)
    .sign(getSecret());
}

export async function verifyAccountOidcTransaction(
  token: string | undefined,
): Promise<AccountOidcTransaction | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const state = String(payload.state || "");
    const nonce = String(payload.nonce || "");
    const codeVerifier = String(payload.cv || "");
    if (!state || !nonce || !codeVerifier) return null;
    return {
      state,
      nonce,
      codeVerifier,
      returnTo: safeNextPath(String(payload.returnTo || "/")),
      mode: payload.mode === "register" ? "register" : "login",
    };
  } catch {
    return null;
  }
}

export { ACCOUNT_OIDC_TX_COOKIE, oidcTransactionCookieOptions };
