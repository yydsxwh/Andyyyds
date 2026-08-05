import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({
  enrollmentId: z.string(),
  lessonId: z.string(),
  completed: z.boolean().optional(),
  positionSec: z.number().int().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: body.enrollmentId },
    });
    if (!enrollment || enrollment.userId !== session.id) {
      return NextResponse.json({ error: "无权更新进度" }, { status: 403 });
    }

    await prisma.lessonProgress.upsert({
      where: {
        enrollmentId_lessonId: {
          enrollmentId: body.enrollmentId,
          lessonId: body.lessonId,
        },
      },
      create: {
        enrollmentId: body.enrollmentId,
        lessonId: body.lessonId,
        completed: body.completed ?? false,
        positionSec: body.positionSec ?? 0,
      },
      update: {
        completed: body.completed ?? undefined,
        positionSec: body.positionSec ?? undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 400 });
  }
}
