/**
 * Auth 回归：未登录 / 登录 / 登出 / 旧 Cookie 重放 / 再登录。
 * 需要本地 Next 已启动（默认 http://127.0.0.1:3000），以及可登录的本地用户。
 * 不连生产库、不 reset DB；用户不存在时只插入一条回归测试账号。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../packages/shared/src/password";
import {
  SESSION_COOKIE_NAME,
  isSessionEpochValid,
} from "../packages/shared/src/auth-session-cookie";

loadEnv();

const BASE = process.env.AUTH_REGRESSION_BASE_URL || "http://127.0.0.1:3000";
const EMAIL = "auth-regression@yyds.local";
const PASSWORD = "123456";
const PROTECTED = "/api/cart";

function parseSetCookie(
  headers: Headers,
  name: string,
): { value: string; raw: string } | null {
  const lines = headers.getSetCookie?.() || [];
  const match = lines.find((line) => {
    const first = line.split(";", 1)[0] || "";
    return first.startsWith(`${name}=`);
  });
  if (!match) return null;
  const first = match.split(";", 1)[0] || "";
  const value = first.slice(name.length + 1);
  return { value, raw: match };
}

function cookieHeader(value: string) {
  return `${SESSION_COOKIE_NAME}=${value}`;
}

async function jsonRequest(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; headers: Headers; body: unknown }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    redirect: "manual",
    headers: {
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, headers: res.headers, body };
}

async function ensureLocalUser() {
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
    if (existing) return existing;
    const suffix = createHash("sha1").update(EMAIL).digest("hex").slice(0, 10);
    return prisma.user.create({
      data: {
        email: EMAIL,
        name: "Auth回归",
        passwordHash: await hashPassword(PASSWORD),
        passwordSet: true,
        role: "STUDENT",
        referralCode: `ar${suffix}`,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function readEpoch(userId: string) {
  const prisma = new PrismaClient();
  try {
    const row = await prisma.user.findUnique({
      where: { id: userId },
      select: { sessionEpoch: true },
    });
    return row?.sessionEpoch ?? 0;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const probe = await fetch(`${BASE}/api/auth/session`, {
    headers: { "Cache-Control": "no-store" },
  }).catch(() => null);
  if (!probe) {
    throw new Error(
      `Auth regression 需要本地服务 ${BASE}，请先 npm run dev（不要连生产库）`,
    );
  }

  const user = await ensureLocalUser();

  const anon = await jsonRequest(PROTECTED);
  assert.equal(anon.status, 401, "测试1：未登录访问 protected API 应为 401");

  const login = await jsonRequest("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  assert.equal(login.status, 200, `测试2：登录应成功，实际 ${login.status}`);
  const sessionCookie = parseSetCookie(login.headers, SESSION_COOKIE_NAME);
  assert.ok(sessionCookie?.value, "测试2：登录响应必须写入 yyds_session");
  assert.equal(/max-age=0/i.test(sessionCookie.raw), false);

  const authed = await jsonRequest(PROTECTED, {
    headers: { Cookie: cookieHeader(sessionCookie.value) },
  });
  assert.equal(authed.status, 200, "测试2：带 Session Cookie 访问 protected API 应成功");

  const epochBefore = await readEpoch(user.id);
  const logout = await jsonRequest("/api/auth/logout", {
    method: "POST",
    headers: { Cookie: cookieHeader(sessionCookie.value) },
  });
  assert.equal(logout.status, 303, `测试3：logout 应为 303，实际 ${logout.status}`);
  const cleared = parseSetCookie(logout.headers, SESSION_COOKIE_NAME);
  assert.ok(cleared, "测试3：logout 必须带回清除 yyds_session 的 Set-Cookie");
  assert.equal(
    /max-age=0/i.test(cleared.raw) || /expires=/i.test(cleared.raw),
    true,
    `测试3：清除 Cookie 必须过期，实际 ${cleared.raw}`,
  );

  const afterLogout = await jsonRequest(PROTECTED);
  assert.equal(afterLogout.status, 401, "测试3：登出后不带 Cookie 应为未认证");

  const replay = await jsonRequest(PROTECTED, {
    headers: { Cookie: cookieHeader(sessionCookie.value) },
  });
  assert.equal(replay.status, 401, "测试4：logout 后携带旧 Cookie 不能恢复登录");

  const epochAfter = await readEpoch(user.id);
  assert.equal(epochAfter > epochBefore, true, "测试4：服务端 sessionEpoch 必须自增");
  assert.equal(isSessionEpochValid(epochBefore, epochAfter), false);

  const loginAgain = await jsonRequest("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  assert.equal(loginAgain.status, 200, "测试5：再登录应成功");
  const nextCookie = parseSetCookie(loginAgain.headers, SESSION_COOKIE_NAME);
  assert.ok(nextCookie?.value, "测试5：再登录必须写入新 Cookie");
  assert.notEqual(nextCookie.value, sessionCookie.value, "测试5：新 Session 不能等于旧 JWT");

  const authedAgain = await jsonRequest(PROTECTED, {
    headers: { Cookie: cookieHeader(nextCookie.value) },
  });
  assert.equal(authedAgain.status, 200, "测试5：新 Session 访问 protected API 应成功");

  const forged = await new SignJWT({
    id: user.id,
    email: EMAIL,
    name: "Auth回归",
    role: "STUDENT",
    sv: epochBefore,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET || ""));
  const forgedRes = await jsonRequest(PROTECTED, {
    headers: { Cookie: cookieHeader(forged) },
  });
  assert.equal(forgedRes.status, 401, "测试4补充：旧 sessionEpoch 的 JWT 必须失效");

  console.log("auth-regression tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
