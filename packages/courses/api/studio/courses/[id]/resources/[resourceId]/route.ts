import { NextResponse } from "next/server";
import { prisma } from "@andyyyds/shared/db";
import { getOwnedResourceInCourse } from "@andyyyds/courses/lib/lesson-resources";
import { deleteStoredFile } from "@andyyyds/shared/storage";
import { requireCourseStudioUser, studioErrorResponse } from "@andyyyds/shared/studio";

export const runtime = "nodejs";

/**
 * 删除课时课件。仅删 LessonResource 记录；
 * 若 fileUrl 在本站 uploads 且归属当前操作者，尝试删物理文件。
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; resourceId: string }> },
) {
  try {
    const session = await requireCourseStudioUser();
    const { id: courseId, resourceId } = await params;

    const resource = await getOwnedResourceInCourse({
      courseId,
      resourceId,
      sessionId: session.id,
      role: session.role,
    });
    if (!resource) {
      return NextResponse.json(
        { error: "课件不存在或无权删除" },
        { status: 404 },
      );
    }

    await prisma.lessonResource.delete({ where: { id: resource.id } });

    // 素材中心挂接的文件勿删物理对象；仅清理 lesson-resources 子目录上传
    if (resource.fileUrl.includes("/lesson-resources/")) {
      try {
        await deleteStoredFile(resource.fileUrl, session.id);
      } catch {
        // 物理删除失败不阻断业务删除
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
