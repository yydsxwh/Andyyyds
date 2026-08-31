import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";

const schema = z.object({
  enrollmentId: z.string(),
  lessonId: z.string(),
  completed: z.boolean().optional(),
  positionSec: z.number().int().min(0).optional(),
  /** 本段新产生的有效观看秒数，服务端累加到 watchedSec */
  watchedDelta: z.number().int().min(0).max(3600).optional(),
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

    const existing = await prisma.lessonProgress.findUnique({
      where: {
        enrollmentId_lessonId: {
          enrollmentId: body.enrollmentId,
          lessonId: body.lessonId,
        },
      },
    });

    const nextWatched =
      (existing?.watchedSec || 0) + (body.watchedDelta ?? 0);
    // 断点位置取更大值，避免偶发回传更小 currentTime 把进度打回去
    const nextPosition = Math.max(
      existing?.positionSec || 0,
      body.positionSec ?? 0,
    );

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
        watchedSec: body.watchedDelta ?? 0,
      },
      update: {
        completed: body.completed ?? undefined,
        positionSec:
          body.positionSec !== undefined ? nextPosition : undefined,
        watchedSec:
          body.watchedDelta !== undefined ? nextWatched : undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "更新失败" }, { status: 400 });
  }
}
