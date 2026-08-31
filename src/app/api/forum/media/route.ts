/**
 * POST /api/forum/media
 * 未配 OSS 时的小文件代理上传（图/视频 ≤ 8MB）。
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { classifyMediaKind, inferMimeType, MAX_PROXY_UPLOAD_BYTES } from "@/lib/media";
import { resolveStoredAccessUrl, storeUpload } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "请选择图片或视频" }, { status: 400 });
    }
    if (file.size > MAX_PROXY_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `未启用云存储时，单文件不能超过 ${Math.round(MAX_PROXY_UPLOAD_BYTES / 1024 / 1024)}MB`,
        },
        { status: 400 },
      );
    }
    const mimeType = inferMimeType(file.type || "", file.name);
    const mediaKind = classifyMediaKind(mimeType, file.name);
    if (mediaKind !== "IMAGE" && mediaKind !== "VIDEO") {
      return NextResponse.json({ error: "只支持图片或视频" }, { status: 400 });
    }
    const stored = await storeUpload({
      ownerId: session.id,
      fileName: file.name || (mediaKind === "VIDEO" ? "video.mp4" : "image.jpg"),
      buffer: Buffer.from(await file.arrayBuffer()),
      mimeType,
      kind: mediaKind === "VIDEO" ? "video" : "file",
      subPath: `forum/${mediaKind.toLowerCase()}`,
    });
    const previewUrl =
      (await resolveStoredAccessUrl(stored.fileUrl)) || stored.fileUrl;
    return NextResponse.json({
      url: stored.fileUrl,
      previewUrl,
      kind: mediaKind === "VIDEO" ? "video" : "image",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
