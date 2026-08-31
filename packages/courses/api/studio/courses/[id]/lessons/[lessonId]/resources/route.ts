import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@andyyyds/shared/db";
import {
  getOwnedLessonInCourse,
  serializeLessonResource,
} from "@andyyyds/courses/lib/lesson-resources";
import {
  ASSET_NAME_MAX,
  MAX_PROXY_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  inferMimeType,
  isAllowedUpload,
} from "@andyyyds/shared/media";
import { canViewAllStudioData } from "@andyyyds/shared/roles";
import { storeUpload } from "@andyyyds/shared/storage";
import { requireCourseStudioUser, studioErrorResponse } from "@andyyyds/shared/studio";

export const runtime = "nodejs";

const jsonSchema = z.object({
  title: z.string().trim().min(1).max(ASSET_NAME_MAX).optional(),
  mediaAssetId: z.string().min(1),
});

/**
 * 上传或从素材中心挂接课件到指定课时。
 * 仅课程所有者（或站长）可操作。
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; lessonId: string }> },
) {
  try {
    const session = await requireCourseStudioUser();
    const { id: courseId, lessonId } = await params;

    const lesson = await getOwnedLessonInCourse({
      courseId,
      lessonId,
      sessionId: session.id,
      role: session.role,
    });
    if (!lesson) {
      return NextResponse.json(
        { error: "课时不存在或无权操作" },
        { status: 404 },
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let title = "";
    let fileName = "";
    let fileUrl = "";
    let mimeType = "";
    let sizeBytes = 0;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      title = String(form.get("title") || "").trim();
      if (!(file instanceof File) || file.size <= 0) {
        return NextResponse.json({ error: "请选择要上传的文件" }, { status: 400 });
      }
      if (file.size > MAX_PROXY_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `文件过大，请控制在 ${MAX_UPLOAD_LABEL} 以内` },
          { status: 400 },
        );
      }
      fileName = file.name || "resource.bin";
      mimeType = inferMimeType(file.type || "", fileName);
      if (!isAllowedUpload(mimeType, fileName)) {
        return NextResponse.json(
          { error: "不支持该文件类型，请上传常见文档/图片等" },
          { status: 400 },
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      sizeBytes = buffer.length;
      const stored = await storeUpload({
        ownerId: session.id,
        fileName,
        buffer,
        mimeType,
        title: title || fileName,
        kind: "file",
        subPath: "lesson-resources",
      });
      fileUrl = stored.fileUrl;
      if (!title) title = fileName.replace(/\.[^.]+$/, "") || fileName;
    } else {
      const body = jsonSchema.parse(await req.json());
      const asset = await prisma.mediaAsset.findFirst({
        where: {
          id: body.mediaAssetId,
          ...(canViewAllStudioData(session.role)
            ? {}
            : { ownerId: session.id }),
        },
      });
      if (!asset) {
        return NextResponse.json(
          { error: "素材不存在或无权使用" },
          { status: 404 },
        );
      }
      title = (body.title || asset.name || asset.fileName).trim();
      fileName = asset.fileName || asset.name || "resource.bin";
      fileUrl = asset.fileUrl;
      mimeType = asset.mimeType || inferMimeType("", fileName);
      sizeBytes = asset.sizeBytes || 0;
    }

    const maxSort = await prisma.lessonResource.aggregate({
      where: { lessonId },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSort._max.sortOrder || 0) + 1;

    const created = await prisma.lessonResource.create({
      data: {
        lessonId,
        title,
        fileName,
        fileUrl,
        mimeType,
        sizeBytes,
        sortOrder,
      },
    });

    return NextResponse.json({
      resource: serializeLessonResource(created),
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

/** 列出某课时下的课件（工作室编辑用） */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; lessonId: string }> },
) {
  try {
    const session = await requireCourseStudioUser();
    const { id: courseId, lessonId } = await params;

    const lesson = await getOwnedLessonInCourse({
      courseId,
      lessonId,
      sessionId: session.id,
      role: session.role,
    });
    if (!lesson) {
      return NextResponse.json(
        { error: "课时不存在或无权访问" },
        { status: 404 },
      );
    }

    const resources = await prisma.lessonResource.findMany({
      where: { lessonId },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({
      resources: resources.map(serializeLessonResource),
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
