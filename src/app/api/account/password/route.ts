/**
 * POST /api/account/password
 * 登录用户修改或首次设置登录密码。
 * 已设过密码须校验当前密码；手机/微信注册未设密码时可直接设置。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z
  .object({
    currentPassword: z.string().optional(),
    newPassword: z.string().min(6, "新密码至少 6 位").max(72, "密码过长"),
    confirmPassword: z.string().min(1, "请再次输入新密码"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "两次输入的新密码不一致",
    path: ["confirmPassword"],
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
      select: { passwordHash: true, passwordSet: true },
    });
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    if (user.passwordSet) {
      const current = (body.currentPassword || "").trim();
      if (!current) {
        return NextResponse.json({ error: "请填写当前密码" }, { status: 400 });
      }
      const ok = await verifyPassword(current, user.passwordHash);
      if (!ok) {
        return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });
      }
      if (current === body.newPassword) {
        return NextResponse.json(
          { error: "新密码不能与当前密码相同" },
          { status: 400 },
        );
      }
    }

    await prisma.user.update({
      where: { id: session.id },
      data: {
        passwordHash: await hashPassword(body.newPassword),
        passwordSet: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message: user.passwordSet
        ? "密码已修改"
        : "密码已设置。若尚未绑定真实邮箱，请在下方绑定后再用邮箱登录",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "参数无效" },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "操作失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
