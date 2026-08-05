import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/types";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return NextResponse.json({ error: "邮箱或密码错误" }, { status: 400 });
    }
    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "登录失败" }, { status: 400 });
  }
}
