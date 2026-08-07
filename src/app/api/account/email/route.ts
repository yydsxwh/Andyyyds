/**
 * POST /api/account/email
 * 登录用户绑定或更换唯一登录邮箱。
 * - 占位邮箱（微信/手机自动注册）：可直接绑定真实邮箱
 * - 未设密码：须同时设置密码，才能用邮箱登录
 * - 已有真实邮箱：须校验当前密码后再更换
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSession,
  getSession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { isPlaceholderEmail } from "@/lib/auth-email";
import { bindEmailToUser } from "@/lib/auth-providers";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/roles";

const schema = z
  .object({
    email: z.string().email("请填写有效邮箱").max(120),
    /** 未设密码时必填；已设密码更换邮箱时用 currentPassword */
    password: z.string().min(6).max(72).optional(),
    confirmPassword: z.string().optional(),
    currentPassword: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.password !== undefined || v.confirmPassword !== undefined) {
      if ((v.password || "") !== (v.confirmPassword || "")) {
        ctx.addIssue({
          code: "custom",
          message: "两次输入的密码不一致",
          path: ["confirmPassword"],
        });
      }
    }
  });

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = schema.parse(await req.json());
    const email = body.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
        passwordSet: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    if (user.email.toLowerCase() === email && !isPlaceholderEmail(user.email)) {
      return NextResponse.json({ ok: true, email, message: "邮箱未变更" });
    }

    const hadRealEmail = !isPlaceholderEmail(user.email);
    const password = (body.password || "").trim();

    // 已有真实邮箱时更换：须验证当前密码，防止盗绑
    if (hadRealEmail) {
      const current = (body.currentPassword || "").trim();
      if (!user.passwordSet || !current) {
        return NextResponse.json(
          { error: "更换邮箱请先填写当前登录密码" },
          { status: 400 },
        );
      }
      const ok = await verifyPassword(current, user.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });
      }
    }

    // 从未设密码：绑定邮箱时一并设置，否则无法邮箱登录
    if (!user.passwordSet) {
      if (password.length < 6) {
        return NextResponse.json(
          { error: "请同时设置至少 6 位登录密码，以便用邮箱登录" },
          { status: 400 },
        );
      }
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await hashPassword(password),
          passwordSet: true,
        },
      });
    }

    await bindEmailToUser({ userId: user.id, email });

    // 刷新会话里的 email，避免顶栏仍显示占位地址
    await createSession({
      id: user.id,
      email,
      name: user.name,
      role: user.role as Role,
    });

    return NextResponse.json({
      ok: true,
      email,
      passwordSet: true,
      message: hadRealEmail
        ? "登录邮箱已更换"
        : "邮箱已绑定，可用邮箱 + 密码、手机号或微信登录同一账号",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "参数无效" },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "绑定失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
