import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveMediaPlayUrl } from "@/lib/aliyun-vod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const schema = z.object({
  lessonId: z.string().min(1),
});

/** 学员播放：校验权限后返回点播/直链地址 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = schema.safeParse({ lessonId: searchParams.get("lessonId") });
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: parsed.data.lessonId },
    include: {
      chapter: { include: { course: true } },
    },
  });
  if (!lesson) {
    return NextResponse.json({ error: "课时不存在" }, { status: 404 });
  }

  const course = lesson.chapter.course;
  const enrolled = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: { userId: session.id, courseId: course.id },
    },
  });
  if (!enrolled && !lesson.isPreview) {
    return NextResponse.json({ error: "请先购买课程" }, { status: 403 });
  }

  try {
    const playUrl = await resolveMediaPlayUrl(lesson.videoUrl);
    if (!playUrl) {
      return NextResponse.json({ error: "暂无播放地址" }, { status: 404 });
    }
    return NextResponse.json({ playUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "获取播放地址失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
