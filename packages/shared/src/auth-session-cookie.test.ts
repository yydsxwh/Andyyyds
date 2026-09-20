import assert from "node:assert/strict";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_PATH,
  applySessionCookie,
  clearSessionCookie,
  isSessionEpochValid,
  sessionCookieClearOptions,
  sessionCookieWriteOptions,
} from "./auth-session-cookie";

assert.equal(SESSION_COOKIE_NAME, "yyds_session");
assert.equal(SESSION_COOKIE_PATH, "/");

{
  const write = sessionCookieWriteOptions();
  const clear = sessionCookieClearOptions();
  assert.equal(write.httpOnly, true);
  assert.equal(clear.httpOnly, true);
  assert.equal(write.path, clear.path);
  assert.equal(write.sameSite, clear.sameSite);
  assert.equal(write.secure, clear.secure);
  assert.equal(write.maxAge > 0, true);
  assert.equal(clear.maxAge, 0);
  assert.ok(clear.expires instanceof Date);
  assert.equal(clear.expires.getTime(), 0);
}

{
  const calls: Array<{ name: string; value: string; maxAge?: number; path?: string }> =
    [];
  const target = {
    set(name: string, value: string, options?: { maxAge?: number; path?: string }) {
      calls.push({ name, value, maxAge: options?.maxAge, path: options?.path });
    },
  };
  applySessionCookie(target, "token-a");
  clearSessionCookie(target);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].name, SESSION_COOKIE_NAME);
  assert.equal(calls[0].value, "token-a");
  assert.equal(calls[0].path, SESSION_COOKIE_PATH);
  assert.ok((calls[0].maxAge || 0) > 0);
  assert.equal(calls[1].name, SESSION_COOKIE_NAME);
  assert.equal(calls[1].value, "");
  assert.equal(calls[1].path, SESSION_COOKIE_PATH);
  assert.equal(calls[1].maxAge, 0);
}

assert.equal(isSessionEpochValid(undefined, 0), true);
assert.equal(isSessionEpochValid(0, 0), true);
assert.equal(isSessionEpochValid(1, 1), true);
assert.equal(isSessionEpochValid(0, 1), false);
assert.equal(isSessionEpochValid(2, 1), false);
assert.equal(isSessionEpochValid("1", 1), true);
assert.equal(isSessionEpochValid("nope", 0), false);

console.log("auth-session-cookie tests passed");
