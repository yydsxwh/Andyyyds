/**
 * 登录会话（JWT Cookie）
 *
 * Cookie 名：yyds_session。角色在 role（主角色）+ roles（多角色列表）。
 * 校验 JWT 后会回查用户表，保证站长改角色后无需重新登录即可生效。
 * 需要登录的 API / 页面先 getSession()，没有则 401 或跳转 /login。
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { hashPassword, makeReferralCode, verifyPassword } from "./password";
import {
  canManageCourses,
  isRoleApplicationPending,
  normalizeRoles,
  primaryRole,
  type Role,
} from "./roles";

export { hashPassword, makeReferralCode, verifyPassword };

const COOKIE_NAME = "yyds_session";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  /** 主角色（优先级最高）；分成比例等仍可读此字段 */
  role: Role;
  /** 全部角色；权限判定优先用此列表 */
  roles: Role[];
  /** 头像：OSS/本地路径或微信 CDN；展示前需 resolveStoredAccessUrl */
  avatarUrl: string;
  /** 注册申请角色（待审核时有值） */
  requestedRole: string;
  roleApplicationStatus: string;
  /** 是否有待站长审核的角色申请 */
  rolePending: boolean;
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is missing");
  return new TextEncoder().encode(secret);
}

export async function createSession(
  user: Pick<SessionUser, "id" | "email" | "name" | "role">,
) {
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const id = String(payload.id);
    // 以数据库角色为准，避免站长改角色后 JWT 仍是旧值
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        roles: true,
        avatarUrl: true,
        requestedRole: true,
        roleApplicationStatus: true,
      },
    });
    if (!user) return null;
    const roles = normalizeRoles({
      role: user.role,
      roles: user.roles || "",
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: primaryRole(roles),
      roles,
      avatarUrl: user.avatarUrl || "",
      requestedRole: user.requestedRole || "",
      roleApplicationStatus: user.roleApplicationStatus || "NONE",
      rolePending: isRoleApplicationPending(user.roleApplicationStatus || ""),
    };
  } catch {
    return null;
  }
}

export async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

/** 课程/素材创作者（站长、加盟代理、老师、入驻商家） */
export async function requireTeacher() {
  const session = await requireUser();
  if (!canManageCourses(session)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.id } });
}
