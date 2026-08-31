/**
 * POST /api/account/role-application
 * 已登录用户在个人中心申请加盟代理 / 商家入驻 / 成为老师。
 * 站长在 /studio/users 审核；不可申请 ADMIN；不可重复 PENDING。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import {
  ACCOUNT_APPLY_SUCCESS_MESSAGE,
  fieldsForApplyFromAccount,
  validateAccountRoleApply,
} from "@andyyyds/shared/role-applications";
import { ELEVATED_APPLY_ROLES, ROLE_LABEL } from "@andyyyds/shared/roles";

const schema = z.object({
  requestedRole: z.enum(ELEVATED_APPLY_ROLES),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = schema.parse(await req.json());
    // 用完整会话（含多角色），避免已有老师身份时仍被当成只能看主角色
    const check = validateAccountRoleApply(
      session,
      session.roleApplicationStatus,
      body.requestedRole,
    );
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: session.id },
      data: fieldsForApplyFromAccount(check.role),
      select: {
        requestedRole: true,
        roleApplicationStatus: true,
        role: true,
      },
    });

    return NextResponse.json({
      ok: true,
      pendingReview: true,
      message: ACCOUNT_APPLY_SUCCESS_MESSAGE,
      requestedRole: updated.requestedRole,
      requestedRoleLabel: ROLE_LABEL[check.role],
      roleApplicationStatus: updated.roleApplicationStatus,
    });
  } catch {
    return NextResponse.json({ error: "提交申请失败" }, { status: 400 });
  }
}
