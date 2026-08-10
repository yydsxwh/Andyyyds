import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  ASSET_DESC_MAX,
  ASSET_NAME_MAX,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  MAX_PROXY_UPLOAD_BYTES,
  classifyMediaKind,
  inferMimeType,
  isAllowedUpload,
  isMediaKind,
} from "@/lib/media";
import { canDeleteMedia } from "@/lib/roles";
import { formatVodError } from "@/lib/aliyun-vod";
import { deleteStoredFile, storeUpload } from "@/lib/storage";
import { requireCourseStudioUser, studioErrorResponse } from "@/lib/studio";

export const runtime = "nodejs";

const metaSchema = z.object({
  name: z.string().trim().min(1).max(ASSET_NAME_MAX),
  description: z.string().trim().max(ASSET_DESC_MAX).optional(),
  categoryId: z.string().optional(),
  durationSec: z.coerce.number().int().min(0).optional(),
});

export async function GET(req: Request) {
  try {
    const session = await requireCourseStudioUser();
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const mediaKind = searchParams.get("type")?.trim().toUpperCase();
    const q = searchParams.get("q")?.trim();

    const assets = await prisma.mediaAsset.findMany({
      where: {
        ownerId: session.id,
        ...(categoryId === "uncategorized"
          ? { categoryId: null }
          : categoryId
            ? { categoryId }
            : {}),
        ...(mediaKind && isMediaKind(mediaKind) ? { type: mediaKind } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { description: { contains: q } },
                { fileName: { contains: q } },
              ],
            }
          : {}),
      },
      include: { category: true },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ assets });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireCourseStudioUser();
    const form = await req.formData();
    const file = form.get("file");
    const externalUrl = String(form.get("externalUrl") || "").trim();

    const parsed = metaSchema.parse({
      name: form.get("name"),
      description: form.get("description") || "",
      categoryId: form.get("categoryId") || undefined,
      durationSec: form.get("durationSec") || 0,
    });

    let categoryFolder = "uncategorized";
    if (parsed.categoryId) {
      const category = await prisma.mediaCategory.findFirst({
        where: { id: parsed.categoryId, ownerId: session.id },
        select: { id: true, name: true },
      });
      if (!category) {
        return NextResponse.json({ error: "分类不存在" }, { status: 400 });
      }
      categoryFolder = category.name || "uncategorized";
    }

    let fileUrl = "";
    let fileName = "";
    let mimeType = "";
    let sizeBytes = 0;
    let storageProvider = "LOCAL";
    let vodVideoId = "";
    let mediaKind = classifyMediaKind("", "");

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { error: `文件不能超过 ${MAX_UPLOAD_LABEL}` },
          { status: 400 },
        );
      }
      // 代理整包进 Node 易 OOM；大文件应走 /prepare 直传
      if (file.size > MAX_PROXY_UPLOAD_BYTES) {
        return NextResponse.json(
          {
            error: `超过 ${Math.round(MAX_PROXY_UPLOAD_BYTES / 1024 / 1024)}MB 请使用直传通道（前端会自动切换）`,
          },
          { status: 400 },
        );
      }
      fileName = file.name || "upload.bin";
      mimeType = inferMimeType(file.type || "", fileName);
      if (!isAllowedUpload(mimeType, fileName)) {
        return NextResponse.json(
          {
            error:
              "不支持的文件类型。支持：视频(mp4/webm/mov/avi)、图片(jpg/png/webp/gif)、音频(mp3/wav/aac/m4a)、文档(pdf/doc/xls/ppt/txt)",
          },
          { status: 400 },
        );
      }
      mediaKind = classifyMediaKind(mimeType, fileName);

      // 存储路径：{媒体类型}/{分类名|uncategorized}，与素材中心分类对齐
      const storageSubPath = `${mediaKind.toLowerCase()}/${categoryFolder}`;

      const buffer = Buffer.from(await file.arrayBuffer());
      try {
        const stored = await storeUpload({
          ownerId: session.id,
          fileName,
          buffer,
          mimeType,
          title: parsed.name,
          // 视频走点播分流；其它类型走 OSS/本地，避免误传点播
          kind: mediaKind === "VIDEO" ? "video" : "file",
          subPath: mediaKind === "VIDEO" ? undefined : storageSubPath,
        });
        fileUrl = stored.fileUrl;
        sizeBytes = file.size;
        storageProvider = stored.provider;
        vodVideoId = stored.vodVideoId || "";
      } catch (uploadError) {
        const raw =
          uploadError instanceof Error ? uploadError.message : "上传失败";
        // 点播签名失败等会带超长 StringToSign；统一收成短中文
        const message =
          /signature is not matched|server string to sign|vod\.|aliyuncs/i.test(
            raw,
          )
            ? formatVodError(uploadError)
            : raw.length > 160
              ? `${raw.slice(0, 140)}…`
              : raw;
        return NextResponse.json({ error: message }, { status: 400 });
      }
    } else if (externalUrl) {
      try {
        const url = new URL(externalUrl);
        if (!["http:", "https:"].includes(url.protocol)) {
          return NextResponse.json({ error: "外链地址无效" }, { status: 400 });
        }
        fileName = decodeURIComponent(url.pathname.split("/").pop() || "external");
        mimeType = inferMimeType("", fileName);
        mediaKind = classifyMediaKind(mimeType, fileName);
        // 历史外链多为视频；扩展名无法判断时仍按视频入库，兼容旧用法
        if (mediaKind === "OTHER") {
          mediaKind = "VIDEO";
          mimeType = mimeType === "application/octet-stream" ? "video/mp4" : mimeType;
        }
      } catch {
        return NextResponse.json({ error: "外链地址无效" }, { status: 400 });
      }
      fileUrl = externalUrl;
      storageProvider = "EXTERNAL";
    } else {
      return NextResponse.json({ error: "请上传文件或填写外链" }, { status: 400 });
    }

    const asset = await prisma.mediaAsset.create({
      data: {
        name: parsed.name,
        description: parsed.description || "",
        type: mediaKind,
        fileUrl,
        fileName,
        mimeType,
        sizeBytes,
        durationSec: parsed.durationSec || 0,
        storageProvider,
        vodVideoId,
        ownerId: session.id,
        categoryId: parsed.categoryId || null,
      },
      include: { category: true },
    });

    return NextResponse.json({ asset });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "请选择要删除的素材").max(100),
});

/** 批量删除素材（仅本人名下；老师无删权限） */
export async function DELETE(req: Request) {
  try {
    const session = await requireCourseStudioUser();
    if (!canDeleteMedia(session.role)) {
      return NextResponse.json(
        { error: "老师账号不可删除素材，请联系站长处理" },
        { status: 403 },
      );
    }
    const body = bulkDeleteSchema.parse(await req.json());
    const uniqueIds = [...new Set(body.ids)];
    const assets = await prisma.mediaAsset.findMany({
      where: { ownerId: session.id, id: { in: uniqueIds } },
    });
    if (assets.length === 0) {
      return NextResponse.json({ error: "没有可删除的素材" }, { status: 404 });
    }

    const deletedIds: string[] = [];
    for (const asset of assets) {
      await prisma.mediaAsset.delete({ where: { id: asset.id } });
      await deleteStoredFile(asset.fileUrl, session.id, {
        vodVideoId: asset.vodVideoId,
        storageProvider: asset.storageProvider,
      });
      deletedIds.push(asset.id);
    }

    return NextResponse.json({
      ok: true,
      deletedIds,
      deletedCount: deletedIds.length,
      skipped: uniqueIds.length - deletedIds.length,
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
