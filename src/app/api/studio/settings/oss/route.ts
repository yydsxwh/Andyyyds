import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  ensureOssBucket,
  testOssConnection,
  testOssUpload,
} from "@/lib/storage";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";
import {
  getSiteSettings,
  invalidateSiteSettingsCache,
  publicSiteSettings,
} from "@/lib/site-settings";

const bodySchema = z.object({
  action: z.enum(["test", "upload-test", "create"]),
  /** 可选：创建前先写入这些字段 */
  ossRegion: z.string().max(64).optional(),
  ossBucket: z.string().max(128).optional(),
  ossAccessKeyId: z.string().max(128).optional(),
  ossAccessKeySecret: z.string().max(128).optional(),
  ossEndpoint: z.string().max(300).optional(),
  ossPublicBaseUrl: z.string().max(300).optional(),
  ossPrefix: z.string().max(120).optional(),
  enableAfterCreate: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = bodySchema.parse(await req.json());
    const current = await getSiteSettings();

    const patch: Record<string, string> = {};
    if (body.ossRegion?.trim()) patch.ossRegion = body.ossRegion.trim();
    if (body.ossBucket?.trim()) patch.ossBucket = body.ossBucket.trim();
    if (body.ossAccessKeyId?.trim()) {
      patch.ossAccessKeyId = body.ossAccessKeyId.trim();
    }
    if (
      body.ossAccessKeySecret?.trim() &&
      !/^\*+/.test(body.ossAccessKeySecret.trim())
    ) {
      patch.ossAccessKeySecret = body.ossAccessKeySecret.trim();
    }
    if (body.ossEndpoint !== undefined) {
      patch.ossEndpoint = body.ossEndpoint.trim();
    }
    if (body.ossPublicBaseUrl !== undefined) {
      patch.ossPublicBaseUrl = body.ossPublicBaseUrl.trim();
    }
    if (body.ossPrefix?.trim()) patch.ossPrefix = body.ossPrefix.trim();

    let settings = current;
    if (Object.keys(patch).length > 0) {
      settings = await prisma.siteSettings.update({
        where: { id: "default" },
        data: patch,
      });
      invalidateSiteSettingsCache();
    }

    if (body.action === "test") {
      const result = await testOssConnection(settings);
      return NextResponse.json({
        ...result,
        settings: publicSiteSettings(await getSiteSettings()),
      });
    }

    // 真正 PutObject 探测：List 通过也不代表 PDF 能入库
    if (body.action === "upload-test") {
      const result = await testOssUpload(settings);
      return NextResponse.json({
        ...result,
        settings: publicSiteSettings(await getSiteSettings()),
      });
    }

    const created = await ensureOssBucket(settings);
    if (body.enableAfterCreate !== false) {
      settings = await prisma.siteSettings.update({
        where: { id: "default" },
        data: {
          storageProvider: "ALIYUN_OSS",
          ossPublicBaseUrl:
            settings.ossPublicBaseUrl || created.publicBase,
          ossRegion: settings.ossRegion || created.region,
        },
      });
      invalidateSiteSettingsCache();
    }

    return NextResponse.json({
      ok: true,
      message: created.message,
      bucket: created.bucket,
      region: created.region,
      publicBase: created.publicBase,
      settings: publicSiteSettings(await getSiteSettings()),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "OSS 操作失败";
    if (
      message.includes("请先填写") ||
      message.includes("创建 Bucket") ||
      message.includes("CORS")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const mapped = studioErrorResponse(error);
    return NextResponse.json(
      { error: mapped.error === "请求失败" ? message : mapped.error },
      { status: mapped.status },
    );
  }
}
