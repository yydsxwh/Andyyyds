import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canPreviewAllLessons } from "@/lib/course-access";
import { prisma } from "@/lib/db";
import {
  signLessonResourceDownloadToken,
} from "@/lib/lesson-resource-access";

export const runtime = "nodejs";

/**
 * 学员下载入口：校验登录 + 报名（或站长/授课预览），
 * 写入下载审计，再签发短时令牌并跳转到实际取文件接口。
 * 不直接暴露永久 fileUrl。
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { resourceId } = await params;
  const resource = await prisma.lessonResource.findUnique({
    where: { id: resourceId },
    include: {
      lesson: {
        include: {
          chapter: {
            include: {
              course: {
                select: { id: true, teacherId: true, productType: true },
              },
            },
          },
        },
      },
    },
  });
  if (!resource) {
    return NextResponse.json({ error: "课件不存在" }, { status: 404 });
  }

  const course = resource.lesson.chapter.course;
  const enrollment = await prisma.enrollment.findUnique({
    where: {
      userId_courseId: { userId: session.id, courseId: course.id },
    },
  });

  const staffPreview = canPreviewAllLessons({
    role: session.role,
    userId: session.id,
    teacherId: course.teacherId,
  });

  // 预览模式不计入学员下载审计（无 enrollment）；正式学员必须有报名
  if (!enrollment && !staffPreview) {
    return NextResponse.json(
      { error: "请先购买课程后再下载课件" },
      { status: 403 },
    );
  }

  let enrollmentId = enrollment?.id || "";
  if (enrollment) {
    await prisma.lessonResourceDownload.create({
      data: {
        resourceId: resource.id,
        userId: session.id,
        enrollmentId: enrollment.id,
      },
    });
    enrollmentId = enrollment.id;
  } else {
    // 站长/老师预览：用占位 enrollmentId 签令牌，便于 file 接口校验
    enrollmentId = `preview:${session.id}`;
  }

  const token = await signLessonResourceDownloadToken({
    resourceId: resource.id,
    userId: session.id,
    enrollmentId,
  });

  const url = new URL(
    `/api/learn/resources/${resource.id}/file`,
    _req.url,
  );
  url.searchParams.set("token", token);

  return NextResponse.redirect(url.toString(), 302);
}
