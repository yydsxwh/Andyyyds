/**
 * POST /api/auth/register
 * 注册时可选身份；不可自选站长。高权限角色进入待审，学员直接可用。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword, makeReferralCode } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  fieldsForSignup,
  PENDING_REVIEW_MESSAGE,
} from "@/lib/role-applications";
import {
  APPLYABLE_ROLES,
  isElevatedApplyRole,
  type Role,
} from "@/lib/roles";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  referralCode: z.string().optional(),
  /** STUDENT 自动通过；AGENT/MERCHANT/TEACHER 待站长审核 */
  requestedRole: z.enum(APPLYABLE_ROLES).optional().default("STUDENT"),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    // 与登录一致：统一小写，避免 Email/email 在 SQLite 下各存一条、登录对不上
    const email = body.email.trim().toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 400 });
    }

    let referredById: string | undefined;
    if (body.referralCode) {
      const { normalizeReferralCode } = await import("@/lib/referral-code");
      const code = normalizeReferralCode(body.referralCode);
      if (code) {
        const inviter = await prisma.user.findFirst({
          where: { referralCode: code },
          select: { id: true },
        });
        if (inviter) referredById = inviter.id;
      }
    }

    const applyRole = body.requestedRole;
    const roleFields = fieldsForSignup(applyRole);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email,
        passwordHash: await hashPassword(body.password),
        referralCode: makeReferralCode(),
        referredById,
        ...roleFields,
      },
    });

    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    });

    if (isElevatedApplyRole(applyRole)) {
      return NextResponse.json({
        ok: true,
        pendingReview: true,
        message: PENDING_REVIEW_MESSAGE,
        requestedRole: applyRole,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "注册失败" }, { status: 400 });
  }
}
