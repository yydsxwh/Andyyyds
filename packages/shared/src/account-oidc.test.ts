import assert from "node:assert/strict";
import {
  accountLogoutAction,
  buildAccountRegisterUrl,
  buildAuthorizeUrl,
  buildUnifiedLogoutHtml,
  createPkcePair,
  escapeHtmlAttr,
  isAllowedCallbackOrigin,
  normalizeIssuer,
  parseAccountSub,
  parseKkNumberClaim,
  readAccountIdClaims,
  resolveAccountRedirectUri,
  resolveCanonicalAuthStartUrl,
} from "./account-oidc";
import { decideIdentityLink, pickProjectionEmail } from "./account-identity";

assert.equal(normalizeIssuer("https://account.yydsxwh.com/"), "https://account.yydsxwh.com");
assert.equal(parseAccountSub("usr_9F3K2M7QX4T8BVZ1CDHJN5PRSW"), "usr_9F3K2M7QX4T8BVZ1CDHJN5PRSW");
assert.equal(parseAccountSub("user@example.com"), null);
assert.equal(parseAccountSub("10001"), null);
assert.equal(parseKkNumberClaim(10086), 10086);
assert.equal(parseKkNumberClaim("10086"), 10086);
assert.equal(parseKkNumberClaim("nope"), null);

{
  const claims = readAccountIdClaims({
    sub: "usr_9F3K2M7QX4T8BVZ1CDHJN5PRSW",
    name: "小明",
    kk_number: 100,
    email: "a@b.com",
  });
  assert.equal(claims?.sub, "usr_9F3K2M7QX4T8BVZ1CDHJN5PRSW");
  assert.equal(claims?.kkNumber, 100);
  assert.equal(claims?.email, "a@b.com");
}

assert.equal(
  pickProjectionEmail({
    sub: "usr_9F3K2M7QX4T8BVZ1CDHJN5PRSW",
    email: "real@example.com",
  }),
  "real@example.com",
);
assert.ok(
  pickProjectionEmail({
    sub: "usr_9F3K2M7QX4T8BVZ1CDHJN5PRSW",
    email: "acc_x@account.local",
  }).endsWith("@account.local"),
);

assert.deepEqual(
  decideIdentityLink({
    existingBySub: { id: "u1" },
    existingByEmail: { id: "u2", accountSub: null },
  }),
  { action: "update", userId: "u1" },
);
assert.deepEqual(
  decideIdentityLink({
    existingBySub: null,
    existingByEmail: { id: "u2", accountSub: null },
  }),
  { action: "link-email", userId: "u2" },
);
assert.deepEqual(
  decideIdentityLink({
    existingBySub: null,
    existingByEmail: { id: "u2", accountSub: "usr_OTHER" },
  }),
  { action: "create" },
);

{
  const pkce = createPkcePair();
  assert.equal(pkce.verifier.length > 20, true);
  assert.equal(pkce.challenge.length > 20, true);
  assert.notEqual(pkce.verifier, pkce.challenge);
}

{
  const authorize = buildAuthorizeUrl(
    {
      issuer: "https://account.yydsxwh.com",
      clientId: "www",
      clientSecret: "",
      redirectUri: "https://yydsxwh.com/api/auth/callback",
      scopes: "openid profile email account.basic",
    },
    {
      state: "st",
      nonce: "nn",
      codeVerifier: "ver",
      codeChallenge: "ch",
    },
  );
  assert.equal(
    authorize.origin + authorize.pathname,
    "https://account.yydsxwh.com/api/oauth/authorize",
  );
  assert.equal(authorize.searchParams.get("code_challenge_method"), "S256");
  assert.equal(authorize.searchParams.get("client_id"), "www");
  const register = buildAccountRegisterUrl(authorize);
  assert.equal(register.pathname, "/register");
  assert.ok(
    (register.searchParams.get("next") || "").startsWith("/api/oauth/authorize"),
  );
}

assert.equal(isAllowedCallbackOrigin("https://yydsxwh.com"), true);
assert.equal(isAllowedCallbackOrigin("https://www.yydsxwh.com"), true);
assert.equal(isAllowedCallbackOrigin("http://localhost:3000"), true);
assert.equal(isAllowedCallbackOrigin("https://evil.com"), false);
assert.equal(isAllowedCallbackOrigin("http://yydsxwh.com"), false);

assert.equal(
  resolveAccountRedirectUri({
    envRedirectUri: "https://www.yydsxwh.com/api/auth/callback",
    requestOrigin: "http://localhost:3000",
  }),
  "https://www.yydsxwh.com/api/auth/callback",
);
assert.equal(
  resolveAccountRedirectUri({
    requestOrigin: "http://localhost:3000",
  }),
  "http://localhost:3000/api/auth/callback",
);

{
  const canonical = resolveCanonicalAuthStartUrl({
    requestUrl:
      "https://yydsxwh.com/api/auth/account/start?mode=login&next=%2Fcourses",
    requestPublicOrigin: "https://yydsxwh.com",
    redirectUri: "https://www.yydsxwh.com/api/auth/callback",
  });
  assert.equal(
    canonical?.toString(),
    "https://www.yydsxwh.com/api/auth/account/start?mode=login&next=%2Fcourses",
  );
}
assert.equal(
  resolveCanonicalAuthStartUrl({
    requestUrl: "https://www.yydsxwh.com/api/auth/account/start?mode=login",
    requestPublicOrigin: "https://www.yydsxwh.com",
    redirectUri: "https://www.yydsxwh.com/api/auth/callback",
  }),
  null,
);
assert.equal(
  resolveCanonicalAuthStartUrl({
    requestUrl: "https://yydsxwh.com/api/auth/account/start?mode=login",
    requestPublicOrigin: "https://yydsxwh.com",
    redirectUri: "https://evil.example/api/auth/callback",
  }),
  null,
);

assert.equal(
  accountLogoutAction("https://account.yydsxwh.com/"),
  "https://account.yydsxwh.com/api/auth/logout",
);
assert.equal(escapeHtmlAttr(`https://x.com/?a="b"`).includes("&quot;"), true);
assert.ok(
  !buildUnifiedLogoutHtml({
    action: "https://account.yydsxwh.com/api/auth/logout",
    next: "https://evil.com/\"><script>alert(1)</script>",
  }).includes("<script>alert(1)"),
);

console.log("account-oidc tests passed");
