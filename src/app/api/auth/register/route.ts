import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword, makeReferralCode } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  referralCode: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const exists = await prisma.user.findUnique({ where: { email: body.email } });
    if (exists) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 400 });
    }

    let referredById: string | undefined;
    if (body.referralCode) {
      const inviter = await prisma.user.findUnique({
        where: { referralCode: body.referralCode },
      });
      if (inviter) referredById = inviter.id;
    }

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        passwordHash: await hashPassword(body.password),
        referralCode: makeReferralCode(),
        referredById,
        role: "STUDENT",
      },
    });

    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "注册失败" }, { status: 400 });
  }
}
