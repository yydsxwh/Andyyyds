/**
 * POST /api/auth/login
 * 待审账号可登录，但响应带 pendingReview，前端引导提示。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@andyyyds/shared/auth";
import { isPlaceholderEmail } from "@andyyyds/shared/auth-email";
import { prisma } from "@andyyyds/shared/db";
import { PENDING_REVIEW_MESSAGE } from "@andyyyds/shared/role-applications";
import { isRoleApplicationPending, type Role } from "@andyyyds/shared/roles";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.trim().toLowerCase();
    if (isPlaceholderEmail(email)) {
      return NextResponse.json(
        { error: "请使用已绑定的真实邮箱登录，或改用手机号 / 微信登录" },
        { status: 400 },
      );
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (
      !user ||
      !user.passwordSet ||
      isPlaceholderEmail(user.email) ||
      !(await verifyPassword(body.password, user.passwordHash))
    ) {
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 400 });
    }
    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    });

    if (isRoleApplicationPending(user.roleApplicationStatus || "")) {
      return NextResponse.json({
        ok: true,
        pendingReview: true,
        message: PENDING_REVIEW_MESSAGE,
        requestedRole: user.requestedRole || "",
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "登录失败" }, { status: 400 });
  }
}
