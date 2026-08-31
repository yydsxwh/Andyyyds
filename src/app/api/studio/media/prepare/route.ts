import { NextResponse } from "next/server";
import { z } from "zod";
import {
  formatVodError,
  createVodBrowserMultipart,
  vodConfigured,
} from "@andyyyds/shared/aliyun-vod";
import {
  ASSET_DESC_MAX,
  ASSET_NAME_MAX,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  MAX_PROXY_UPLOAD_BYTES,
  classifyMediaKind,
  inferMimeType,
  isAllowedUpload,
} from "@andyyyds/shared/media";
import { getSiteSettings } from "@andyyyds/shared/site-settings";
import {
  createOssBrowserMultipart,
  ensureOssBrowserUploadCors,
  ossStorageConfigured,
} from "@andyyyds/shared/storage";
import { prisma } from "@andyyyds/shared/db";
import { requireCourseStudioUser, studioErrorResponse } from "@andyyyds/shared/studio";

export const runtime = "nodejs";

const prepareSchema = z.object({
  name: z.string().trim().min(1).max(ASSET_NAME_MAX),
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().max(120).optional(),
  sizeBytes: z.coerce.number().int().positive().max(MAX_UPLOAD_BYTES),
  categoryId: z.string().optional(),
  description: z.string().trim().max(ASSET_DESC_MAX).optional(),
});

/**
 * 为大文件签发直传凭证：视频优先点播 STS，其它走 OSS 预签名分片。
 * 故意不经本机收整包，避免 Next 10MB 克隆与服务器 OOM。
 */
export async function POST(req: Request) {
  try {
    const session = await requireCourseStudioUser();
    const body = prepareSchema.parse(await req.json());
    const mimeType = inferMimeType(body.mimeType || "", body.fileName);
    if (!isAllowedUpload(mimeType, body.fileName)) {
      return NextResponse.json(
        {
          error:
            "不支持的文件类型。支持：视频(mp4/webm/mov/avi)、图片(jpg/png/webp/gif)、音频(mp3/wav/aac/m4a)、文档(pdf/doc/xls/ppt/txt)",
        },
        { status: 400 },
      );
    }

    let categoryFolder = "uncategorized";
    if (body.categoryId) {
      const category = await prisma.mediaCategory.findFirst({
        where: { id: body.categoryId, ownerId: session.id },
        select: { id: true, name: true },
      });
      if (!category) {
        return NextResponse.json({ error: "分类不存在" }, { status: 400 });
      }
      categoryFolder = category.name || "uncategorized";
    }

    const mediaKind = classifyMediaKind(mimeType, body.fileName);
    const settings = await getSiteSettings();
    const storageSubPath = `${mediaKind.toLowerCase()}/${categoryFolder}`;

    if (
      mediaKind === "VIDEO" &&
      settings.videoStorageProvider === "ALIYUN_VOD" &&
      vodConfigured(settings)
    ) {
      try {
        // 服务端签发点播 STS 预签名分片 URL；浏览器只 PUT，避免前端 HMAC 签名失败
        const cred = await createVodBrowserMultipart({
          title: body.name,
          fileName: body.fileName,
          fileSize: body.sizeBytes,
          mimeType,
          settings,
        });
        return NextResponse.json({
          mode: "vod_multipart" as const,
          mediaKind,
          mimeType,
          maxBytes: MAX_UPLOAD_BYTES,
          maxLabel: MAX_UPLOAD_LABEL,
          vod: {
            videoId: cred.videoId,
            fileUrl: cred.fileUrl,
            host: cred.host,
            bucket: cred.bucket,
            objectKey: cred.objectKey,
            accessKeyId: cred.accessKeyId,
            accessKeySecret: cred.accessKeySecret,
            securityToken: cred.securityToken,
            uploadId: cred.uploadId,
            partSize: cred.partSize,
            parts: cred.parts,
          },
        });
      } catch (error) {
        return NextResponse.json(
          { error: formatVodError(error) },
          { status: 400 },
        );
      }
    }

    if (ossStorageConfigured(settings)) {
      try {
        await ensureOssBrowserUploadCors();
      } catch {
        // CORS 更新失败时仍尝试签发；浏览器若跨域失败会给出明确错误
      }
      const multipart = await createOssBrowserMultipart({
        ownerId: session.id,
        fileName: body.fileName,
        mimeType,
        fileSize: body.sizeBytes,
        subPath: storageSubPath,
      });
      return NextResponse.json({
        mode: "oss_multipart" as const,
        mediaKind,
        mimeType,
        maxBytes: MAX_UPLOAD_BYTES,
        maxLabel: MAX_UPLOAD_LABEL,
        oss: multipart,
      });
    }

    // 仅本地磁盘时无法直传云；小文件可走旧代理，大文件需先配点播/OSS
    if (body.sizeBytes > MAX_PROXY_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `超过 ${Math.round(MAX_PROXY_UPLOAD_BYTES / 1024 / 1024)}MB 的文件需启用阿里云点播或 OSS 直传；当前为本地存储`,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      mode: "proxy" as const,
      mediaKind,
      mimeType,
      maxBytes: MAX_PROXY_UPLOAD_BYTES,
      maxLabel: `${Math.round(MAX_PROXY_UPLOAD_BYTES / 1024 / 1024)}MB`,
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
