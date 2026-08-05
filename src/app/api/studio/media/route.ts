import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  ALLOWED_VIDEO_MIME,
  ASSET_DESC_MAX,
  ASSET_NAME_MAX,
  MAX_UPLOAD_BYTES,
} from "@/lib/media";
import { storeUpload } from "@/lib/storage";
import { requireStudioUser, studioErrorResponse } from "@/lib/studio";

export const runtime = "nodejs";

const metaSchema = z.object({
  name: z.string().trim().min(1).max(ASSET_NAME_MAX),
  description: z.string().trim().max(ASSET_DESC_MAX).optional(),
  categoryId: z.string().optional(),
  durationSec: z.coerce.number().int().min(0).optional(),
});

export async function GET(req: Request) {
  try {
    const session = await requireStudioUser();
    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");
    const q = searchParams.get("q")?.trim();

    const assets = await prisma.mediaAsset.findMany({
      where: {
        ownerId: session.id,
        ...(categoryId === "uncategorized"
          ? { categoryId: null }
          : categoryId
            ? { categoryId }
            : {}),
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
    const session = await requireStudioUser();
    const form = await req.formData();
    const file = form.get("file");
    const externalUrl = String(form.get("externalUrl") || "").trim();

    const parsed = metaSchema.parse({
      name: form.get("name"),
      description: form.get("description") || "",
      categoryId: form.get("categoryId") || undefined,
      durationSec: form.get("durationSec") || 0,
    });

    if (parsed.categoryId) {
      const category = await prisma.mediaCategory.findFirst({
        where: { id: parsed.categoryId, ownerId: session.id },
      });
      if (!category) {
        return NextResponse.json({ error: "分类不存在" }, { status: 400 });
      }
    }

    let fileUrl = "";
    let fileName = "";
    let mimeType = "";
    let sizeBytes = 0;

    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ error: "视频不能超过 300MB" }, { status: 400 });
      }
      if (file.type && !ALLOWED_VIDEO_MIME.has(file.type)) {
        return NextResponse.json(
          { error: "仅支持 mp4 / webm / mov / avi / mpeg" },
          { status: 400 },
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const stored = await storeUpload({
        ownerId: session.id,
        fileName: file.name || "video.mp4",
        buffer,
        mimeType: file.type || "video/mp4",
      });
      fileUrl = stored.fileUrl;
      fileName = file.name;
      mimeType = file.type || "video/mp4";
      sizeBytes = file.size;
    } else if (externalUrl) {
      try {
        const url = new URL(externalUrl);
        if (!["http:", "https:"].includes(url.protocol)) {
          return NextResponse.json({ error: "外链地址无效" }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: "外链地址无效" }, { status: 400 });
      }
      fileUrl = externalUrl;
      fileName = externalUrl.split("/").pop() || "external-video";
      mimeType = "video/mp4";
    } else {
      return NextResponse.json({ error: "请上传视频文件或填写视频链接" }, { status: 400 });
    }

    const asset = await prisma.mediaAsset.create({
      data: {
        name: parsed.name,
        description: parsed.description || "",
        type: "VIDEO",
        fileUrl,
        fileName,
        mimeType,
        sizeBytes,
        durationSec: parsed.durationSec || 0,
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
