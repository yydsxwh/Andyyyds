/**
 * 把 account OIDC 身份投影到主站本地 User。
 *
 * 本地 User 只服务商城/论坛/课程等业务，不再当身份源。
 * 关联键只有 accountSub=usr_xxx；邮箱只用于兼容挂钩已有行，不当跨产品主键。
 * 不把 account 的站长角色抄到主站——两边角色体系不同。
 */

import { randomBytes } from "node:crypto";
import { isPlaceholderEmail } from "./auth-email";
import { prisma } from "./db";
import { hashPassword, makeReferralCode } from "./password";
import type { AccountIdClaims } from "./account-oidc";
import { parseAccountSub } from "./account-oidc";

export function accountProjectionEmail(sub: string): string {
  const body = sub.replace(/^usr_/, "").slice(0, 24).toLowerCase() || "user";
  return `acc_${body}@account.local`;
}

export function pickProjectionEmail(input: {
  sub: string;
  email: string;
}): string {
  const email = (input.email || "").trim().toLowerCase();
  if (email && !isPlaceholderEmail(email)) return email;
  return accountProjectionEmail(input.sub);
}

export type IdentityLinkDecision =
  | { action: "update"; userId: string }
  | { action: "link-email"; userId: string }
  | { action: "create" };

export function decideIdentityLink(input: {
  existingBySub: { id: string } | null;
  existingByEmail: { id: string; accountSub: string | null } | null;
}): IdentityLinkDecision {
  if (input.existingBySub) {
    return { action: "update", userId: input.existingBySub.id };
  }
  // 仅挂钩「尚未绑定 account sub」的旧行，避免抢别人已经联邦过的账号
  if (input.existingByEmail && !input.existingByEmail.accountSub) {
    return { action: "link-email", userId: input.existingByEmail.id };
  }
  return { action: "create" };
}

async function uniqueReferralCode() {
  for (let i = 0; i < 8; i += 1) {
    const code = makeReferralCode();
    const exists = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  return `YY${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex")}`;
}

function displayName(claims: AccountIdClaims): string {
  return (
    claims.name ||
    claims.preferredUsername ||
    claims.username ||
    (claims.kkNumber ? `用户${claims.kkNumber}` : "") ||
    "用户"
  );
}

export async function upsertLocalUserFromAccount(claims: AccountIdClaims) {
  const sub = parseAccountSub(claims.sub);
  if (!sub) throw new Error("invalid account sub");

  const realEmail =
    claims.email && !isPlaceholderEmail(claims.email) ? claims.email : "";

  const [existingBySub, existingByEmail] = await Promise.all([
    prisma.user.findUnique({
      where: { accountSub: sub },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        kkNumber: true,
        email: true,
        phone: true,
      },
    }),
    realEmail
      ? prisma.user.findUnique({
          where: { email: realEmail },
          select: { id: true, accountSub: true },
        })
      : Promise.resolve(null),
  ]);

  const decision = decideIdentityLink({
    existingBySub,
    existingByEmail,
  });

  const snapshot = {
    accountSub: sub,
    name: displayName(claims) || existingBySub?.name || "用户",
    avatarUrl: claims.picture || existingBySub?.avatarUrl || "",
    kkNumber: claims.kkNumber ?? existingBySub?.kkNumber ?? null,
    phone: claims.phone || existingBySub?.phone || "",
  };

  if (decision.action !== "create") {
    return prisma.user.update({
      where: { id: decision.userId },
      data: {
        accountSub: sub,
        name: snapshot.name,
        avatarUrl: snapshot.avatarUrl,
        kkNumber: snapshot.kkNumber,
        ...(snapshot.phone ? { phone: snapshot.phone } : {}),
      },
    });
  }

  // 真实邮箱已被另一条已联邦账号占用时，不能抢邮箱，改用占位邮箱
  const email =
    existingByEmail
      ? accountProjectionEmail(sub)
      : pickProjectionEmail({ sub, email: claims.email });

  return prisma.user.create({
    data: {
      accountSub: sub,
      email,
      passwordHash: await hashPassword(randomBytes(32).toString("hex")),
      passwordSet: false,
      name: snapshot.name,
      avatarUrl: snapshot.avatarUrl,
      kkNumber: snapshot.kkNumber,
      phone: snapshot.phone,
      referralCode: await uniqueReferralCode(),
    },
  });
}
