/**
 * GET/PATCH /api/studio/users —— 站长用户管理
 *
 * - GET：列表（?pending=1 仅待审申请）
 * - PATCH { userId, roles: Role[] } 或 { userId, role }：设置多角色 / 单角色
 * - PATCH { userId, referralCode }：设置邀请码（含站长自己）
 * - PATCH { userId, applicationAction: approve|reject, note? }：审核注册申请
 * - PATCH { userId, unbindWechat: true }：清空微信 openid/unionid，便于用户重新绑定
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  approveSuccessMessage,
  fieldsAfterManualRoleChange,
  fieldsForApprove,
  fieldsForReject,
  REJECT_SUCCESS_MESSAGE,
} from "@/lib/role-applications";
import {
  isValidReferralCode,
  normalizeReferralCode,
} from "@/lib/referral-code";
import {
  hasRole,
  isElevatedApplyRole,
  normalizeRoles,
  roleLabels,
  ROLES,
  type Role,
} from "@/lib/roles";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  roles: true,
  requestedRole: true,
  roleApplicationStatus: true,
  roleApplicationNote: true,
  roleReviewedAt: true,
  referralCode: true,
} as const;

function serializeUser<
  T extends {
    role: string;
    roles: string;
    roleReviewedAt: Date | null;
  },
>(u: T) {
  const roles = normalizeRoles({ role: u.role, roles: u.roles });
  return {
    ...u,
    roles,
    rolesLabel: roleLabels(roles),
    roleReviewedAt: u.roleReviewedAt?.toISOString() ?? null,
  };
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const role = (url.searchParams.get("role") || "").trim().toUpperCase();
    const pendingOnly = url.searchParams.get("pending") === "1";

    const users = await prisma.user.findMany({
      where: {
        AND: [
          q
            ? {
                OR: [
                  { name: { contains: q } },
                  { email: { contains: q } },
                ],
              }
            : {},
          pendingOnly ? { roleApplicationStatus: "PENDING" } : {},
        ],
      },
      select: {
        ...userSelect,
        referralCode: true,
        wechatOpenId: true,
        wechatWebOpenId: true,
        createdAt: true,
        referredBy: { select: { id: true, name: true, referralCode: true } },
        referrals: {
          select: {
            id: true,
            name: true,
            email: true,
            referralCode: true,
            role: true,
            roles: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        },
        _count: {
          select: {
            orders: true,
            enrollments: true,
            courses: true,
            referrals: true,
          },
        },
      },
      orderBy: pendingOnly
        ? { createdAt: "asc" }
        : { createdAt: "desc" },
      take: 200,
    });

    const filtered =
      role && (ROLES as readonly string[]).includes(role)
        ? users.filter((u) =>
            hasRole({ role: u.role, roles: u.roles }, role as Role),
          )
        : users;

    return NextResponse.json({
      users: filtered.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        roles: normalizeRoles({ role: u.role, roles: u.roles }),
        rolesLabel: roleLabels({ role: u.role, roles: u.roles }),
        requestedRole: u.requestedRole,
        roleApplicationStatus: u.roleApplicationStatus,
        roleApplicationNote: u.roleApplicationNote,
        roleReviewedAt: u.roleReviewedAt?.toISOString() ?? null,
        referralCode: u.referralCode,
        referredById: u.referredBy?.id || "",
        referredByName: u.referredBy?.name || "",
        referredByCode: u.referredBy?.referralCode || "",
        hasWechat: Boolean(
          u.wechatOpenId?.trim() || u.wechatWebOpenId?.trim(),
        ),
        createdAt: u.createdAt.toISOString(),
        orderCount: u._count.orders,
        enrollmentCount: u._count.enrollments,
        courseCount: u._count.courses,
        referralCount: u._count.referrals,
        invitees: u.referrals.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          referralCode: r.referralCode,
          role: r.role,
          roles: normalizeRoles({ role: r.role, roles: r.roles }),
          createdAt: r.createdAt.toISOString(),
        })),
      })),
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

const setRolesSchema = z.object({
  userId: z.string().min(1),
  roles: z.array(z.enum(ROLES)).min(1).max(ROLES.length),
});

const setRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(ROLES),
});

const setReferralSchema = z.object({
  userId: z.string().min(1),
  referralCode: z.string().min(1).max(32),
});

const applicationSchema = z.object({
  userId: z.string().min(1),
  applicationAction: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
});

const unbindWechatSchema = z.object({
  userId: z.string().min(1),
  unbindWechat: z.literal(true),
});

export async function PATCH(req: Request) {
  try {
    const admin = await requireAdmin();
    const raw = await req.json();

    if (raw?.unbindWechat === true) {
      const body = unbindWechatSchema.parse(raw);
      const target = await prisma.user.findUnique({
        where: { id: body.userId },
        select: {
          id: true,
          wechatOpenId: true,
          wechatWebOpenId: true,
          wechatUnionId: true,
        },
      });
      if (!target) {
        return NextResponse.json({ error: "用户不存在" }, { status: 404 });
      }
      if (
        !target.wechatOpenId?.trim() &&
        !target.wechatWebOpenId?.trim() &&
        !target.wechatUnionId?.trim()
      ) {
        return NextResponse.json({ error: "该用户未绑定微信" }, { status: 400 });
      }
      await prisma.user.update({
        where: { id: body.userId },
        data: { wechatOpenId: "", wechatWebOpenId: "", wechatUnionId: "" },
      });
      return NextResponse.json({
        ok: true,
        hasWechat: false,
        message: "已解绑微信，用户可在个人中心重新绑定",
      });
    }

    if (
      "referralCode" in raw &&
      !("role" in raw) &&
      !("roles" in raw) &&
      !("applicationAction" in raw)
    ) {
      const body = setReferralSchema.parse(raw);
      const code = normalizeReferralCode(body.referralCode);
      if (!isValidReferralCode(code)) {
        return NextResponse.json(
          { error: "邀请码须为 4～16 位字母或数字" },
          { status: 400 },
        );
      }
      const target = await prisma.user.findUnique({ where: { id: body.userId } });
      if (!target) {
        return NextResponse.json({ error: "用户不存在" }, { status: 404 });
      }
      if (target.referralCode === code) {
        const same = await prisma.user.findUnique({
          where: { id: body.userId },
          select: userSelect,
        });
        return NextResponse.json({
          user: same ? serializeUser(same) : null,
          message: "邀请码未改变",
        });
      }
      const taken = await prisma.user.findFirst({
        where: { referralCode: code, NOT: { id: body.userId } },
        select: { id: true, name: true },
      });
      if (taken) {
        return NextResponse.json(
          { error: `邀请码已被「${taken.name}」使用，请换一个` },
          { status: 400 },
        );
      }
      const updated = await prisma.user.update({
        where: { id: body.userId },
        data: { referralCode: code },
        select: userSelect,
      });
      return NextResponse.json({
        user: serializeUser(updated),
        message: "邀请码已更新",
      });
    }

    if ("applicationAction" in raw) {
      const body = applicationSchema.parse(raw);
      const target = await prisma.user.findUnique({ where: { id: body.userId } });
      if (!target) {
        return NextResponse.json({ error: "用户不存在" }, { status: 404 });
      }
      if (target.roleApplicationStatus !== "PENDING") {
        return NextResponse.json({ error: "该用户没有待审核申请" }, { status: 400 });
      }
      if (!isElevatedApplyRole(target.requestedRole)) {
        return NextResponse.json({ error: "申请角色无效" }, { status: 400 });
      }

      if (body.applicationAction === "approve") {
        const updated = await prisma.user.update({
          where: { id: body.userId },
          data: fieldsForApprove(
            target.requestedRole,
            admin.id,
            body.note,
            { role: target.role, roles: target.roles },
          ),
          select: userSelect,
        });
        return NextResponse.json({
          user: serializeUser(updated),
          message: approveSuccessMessage(target.requestedRole),
        });
      }

      const updated = await prisma.user.update({
        where: { id: body.userId },
        data: fieldsForReject(admin.id, body.note),
        select: userSelect,
      });
      return NextResponse.json({
        user: serializeUser(updated),
        message: REJECT_SUCCESS_MESSAGE,
      });
    }

    const nextRoles: Role[] = Array.isArray(raw?.roles)
      ? setRolesSchema.parse(raw).roles
      : [setRoleSchema.parse(raw).role];

    const bodyUserId = String(raw.userId || "");
    const target = await prisma.user.findUnique({ where: { id: bodyUserId } });
    if (!target) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const list = normalizeRoles(nextRoles);
    if (target.id === admin.id && !list.includes("ADMIN")) {
      return NextResponse.json(
        { error: "不能取消自己的站长身份" },
        { status: 400 },
      );
    }

    if (
      hasRole({ role: target.role, roles: target.roles }, "ADMIN") &&
      !list.includes("ADMIN")
    ) {
      const adminCount = await prisma.user.count({
        where: {
          OR: [{ role: "ADMIN" }, { roles: { contains: "ADMIN" } }],
        },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "至少保留一位站长" },
          { status: 400 },
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: bodyUserId },
      data: fieldsAfterManualRoleChange(list, admin.id),
      select: userSelect,
    });

    return NextResponse.json({
      user: serializeUser(updated),
      message: `角色已更新为：${roleLabels(list)}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
