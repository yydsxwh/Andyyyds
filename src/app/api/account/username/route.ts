/**
 * POST /api/account/username
 * 登录用户绑定或更换「登录账号」（与邮箱分开）。
 * - 未设密码：须同时设置密码
 * - 已有登录账号更换：须校验当前密码
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, verifyPassword } from "@andyyyds/shared/auth";
import { bindUsernameToUser } from "@andyyyds/shared/auth-providers";
import { prisma } from "@andyyyds/shared/db";

const schema = z
  .object({
    username: z.string().min(1).max(40),
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
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        passwordSet: true,
      },
    });
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const hadUsername = Boolean(user.username);
    if (hadUsername) {
      const current = (body.currentPassword || "").trim();
      if (!user.passwordSet || !current) {
        return NextResponse.json(
          { error: "更换登录账号请先填写当前登录密码" },
          { status: 400 },
        );
      }
      const ok = await verifyPassword(current, user.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });
      }
    }

    const bound = await bindUsernameToUser({
      userId: user.id,
      username: body.username,
      password: body.password,
    });

    return NextResponse.json({
      ok: true,
      username: bound.username,
      passwordSet: bound.passwordSet,
      message: hadUsername
        ? "登录账号已更换"
        : "登录账号已绑定，可用账号 + 密码、邮箱、手机号或微信登录同一账号",
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
