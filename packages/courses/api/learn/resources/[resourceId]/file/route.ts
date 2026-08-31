import { createReadStream } from "fs";
import { access } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { prisma } from "@andyyyds/shared/db";
import {
  downloadFileNameForUser,
  LESSON_RESOURCE_OSS_TTL_SEC,
  verifyLessonResourceDownloadToken,
} from "@andyyyds/courses/lib/lesson-resource-access";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";

export const runtime = "nodejs";

/**
 * 短时令牌取文件：验证 JWT 后签发 OSS 短链或流式本地文件。
 * Cache-Control: private，禁止公共 CDN 长期缓存课件。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  const { resourceId } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") || "";
  const claims = await verifyLessonResourceDownloadToken(token);
  if (!claims || claims.resourceId !== resourceId) {
    return NextResponse.json(
      { error: "下载链接无效或已过期，请重新点击下载" },
      { status: 403 },
    );
  }

  const resource = await prisma.lessonResource.findUnique({
    where: { id: resourceId },
  });
  if (!resource) {
    return NextResponse.json({ error: "课件不存在" }, { status: 404 });
  }

  const dispositionName = downloadFileNameForUser(
    resource.fileName || resource.title,
    claims.userId,
  );
  const contentDisposition = `attachment; filename*=UTF-8''${encodeURIComponent(dispositionName)}`;

  // 本地 uploads：服务端流式下发，避免暴露可猜路径
  if (resource.fileUrl.startsWith("/uploads/")) {
    const absolute = path.join(
      process.cwd(),
      "public",
      resource.fileUrl.replace(/^\/+/, ""),
    );
    try {
      await access(absolute);
      const nodeStream = createReadStream(absolute);
      const webStream = Readable.toWeb(nodeStream) as ReadableStream;
      return new NextResponse(webStream, {
        status: 200,
        headers: {
          "Content-Type": resource.mimeType || "application/octet-stream",
          "Content-Disposition": contentDisposition,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      // 本地丢失时尝试走 OSS 同 key（与视频播放兼容逻辑一致）
    }
  }

  try {
    const signed = await resolveStoredAccessUrl(
      resource.fileUrl,
      LESSON_RESOURCE_OSS_TTL_SEC,
    );
    if (!signed) {
      return NextResponse.json({ error: "文件地址无效" }, { status: 404 });
    }

    // 站外短时签名链：再跳一次；响应头无法改 OSS，但 URL 会过期
    if (signed.startsWith("http://") || signed.startsWith("https://")) {
      const res = NextResponse.redirect(signed, 302);
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    }

    // 仍是站内相对路径
    const absolute = path.join(
      process.cwd(),
      "public",
      signed.replace(/^\/+/, ""),
    );
    await access(absolute);
    const nodeStream = createReadStream(absolute);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": resource.mimeType || "application/octet-stream",
        "Content-Disposition": contentDisposition,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "文件不存在或已被清理，请联系老师重新上传" },
      { status: 404 },
    );
  }
}
