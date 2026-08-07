/**
 * PATCH /api/account/profile
 * 当前登录用户修改个人资料（目前支持昵称）。
 * 写库后刷新会话 Cookie，顶栏名字立刻同步。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "请填写昵称")
    .max(40, "昵称最多 40 个字"),
});

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const body = schema.parse(await req.json());
    const updated = await prisma.user.update({
      where: { id: session.id },
      data: { name: body.name },
      select: { id: true, email: true, name: true, role: true },
    });

    await createSession({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role as typeof session.role,
    });

    return NextResponse.json({ ok: true, name: updated.name });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "参数无效" },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : "保存失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
