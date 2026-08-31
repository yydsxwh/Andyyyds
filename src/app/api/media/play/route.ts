import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@andyyyds/shared/auth";
import { canPreviewAllLessons } from "@andyyyds/courses/lib/course-access";
import { prisma } from "@andyyyds/shared/db";
import {
  LOCAL_MEDIA_MISSING_MESSAGE,
  pickLessonMediaSource,
  resolveMediaAccessUrl,
} from "@andyyyds/shared/storage";

export const runtime = "nodejs";

const schema = z.object({
  lessonId: z.string().min(1),
});

/** 学员 / 站长预览：校验权限后返回点播或 OSS 签名播放地址 */
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
      mediaAsset: true,
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
  const staffPreview = canPreviewAllLessons({
    role: session.role,
    userId: session.id,
    teacherId: course.teacherId,
  });
  if (!enrolled && !lesson.isPreview && !staffPreview) {
    const tip =
      course.productType === "MATERIAL" ? "请先购买资料" : "请先购买课程";
    return NextResponse.json({ error: tip }, { status: 403 });
  }

  try {
    const sourceUrl = pickLessonMediaSource({
      videoUrl: lesson.videoUrl,
      mediaAsset: lesson.mediaAsset,
    });
    const playUrl = await resolveMediaAccessUrl(sourceUrl);
    if (!playUrl) {
      return NextResponse.json({ error: "暂无播放地址" }, { status: 404 });
    }
    return NextResponse.json({ playUrl });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "获取播放地址失败";
    const missing = message === LOCAL_MEDIA_MISSING_MESSAGE;
    return NextResponse.json(
      { error: message },
      { status: missing ? 404 : 400 },
    );
  }
}
