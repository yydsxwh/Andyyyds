/**
 * POST /api/forum/media/prepare
 * 已登录用户为论坛附件签发上传方式：图片/视频走 OSS 分片，未配云存储时小文件走本机代理。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { FORUM_MEDIA_MAX } from "@/lib/forum";
import {
  MAX_PROXY_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  classifyMediaKind,
  inferMimeType,
} from "@/lib/media";
import { getSiteSettings } from "@/lib/site-settings";
import {
  createOssBrowserMultipart,
  ensureOssBrowserUploadCors,
  ossStorageConfigured,
} from "@/lib/storage";

export const runtime = "nodejs";

const schema = z.object({
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().max(120).optional(),
  sizeBytes: z.coerce.number().int().positive().max(MAX_UPLOAD_BYTES),
});

function isForumMediaFile(mimeType: string, fileName: string) {
  const kind = classifyMediaKind(mimeType, fileName);
  return kind === "IMAGE" || kind === "VIDEO";
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const body = schema.parse(await req.json());
    const mimeType = inferMimeType(body.mimeType || "", body.fileName);
    if (!isForumMediaFile(mimeType, body.fileName)) {
      return NextResponse.json(
        { error: "只支持图片或视频（jpg/png/webp/gif、mp4/mov/webm）" },
        { status: 400 },
      );
    }
    const mediaKind = classifyMediaKind(mimeType, body.fileName);
    const settings = await getSiteSettings();
    const subPath = `forum/${mediaKind.toLowerCase()}`;

    if (ossStorageConfigured(settings)) {
      try {
        await ensureOssBrowserUploadCors();
      } catch {
        // CORS 失败仍签发，浏览器报错时再提示
      }
      const oss = await createOssBrowserMultipart({
        ownerId: session.id,
        fileName: body.fileName,
        mimeType,
        fileSize: body.sizeBytes,
        subPath,
      });
      return NextResponse.json({
        mode: "oss_multipart" as const,
        kind: mediaKind === "VIDEO" ? "video" : "image",
        mimeType,
        maxCount: FORUM_MEDIA_MAX,
        oss,
      });
    }

    if (body.sizeBytes > MAX_PROXY_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `超过 ${Math.round(MAX_PROXY_UPLOAD_BYTES / 1024 / 1024)}MB 的视频需启用云存储直传`,
        },
        { status: 400 },
      );
    }
    return NextResponse.json({
      mode: "proxy" as const,
      kind: mediaKind === "VIDEO" ? "video" : "image",
      mimeType,
      maxBytes: MAX_PROXY_UPLOAD_BYTES,
      maxLabel: MAX_UPLOAD_LABEL,
    });
  } catch {
    return NextResponse.json({ error: "无法开始上传" }, { status: 400 });
  }
}
