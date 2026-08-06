import { NextResponse } from "next/server";
import { z } from "zod";
import { testVodConnection } from "@/lib/aliyun-vod";
import { prisma } from "@/lib/db";
import {
  getSiteSettings,
  invalidateSiteSettingsCache,
  isMaskedPlaceholder,
  pickSecretUpdate,
  publicSiteSettings,
} from "@/lib/site-settings";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";

export const runtime = "nodejs";

const schema = z.object({
  action: z.enum(["test"]),
  vodRegionId: z.string().max(64).optional(),
  vodAccessKeyId: z.string().max(128).optional(),
  vodAccessKeySecret: z.string().max(128).optional(),
  vodTemplateGroupId: z.string().max(128).optional(),
  vodPlayDomain: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = schema.parse(await req.json());
    const current = await getSiteSettings();

    const nextSecret = pickSecretUpdate(
      body.vodAccessKeySecret,
      current.vodAccessKeySecret,
    );

    const probe = {
      ...current,
      vodRegionId: (body.vodRegionId || current.vodRegionId || "cn-shanghai").trim(),
      vodAccessKeyId: (body.vodAccessKeyId || current.vodAccessKeyId).trim(),
      vodAccessKeySecret: nextSecret ?? current.vodAccessKeySecret,
      vodTemplateGroupId: (
        body.vodTemplateGroupId ||
        current.vodTemplateGroupId ||
        "VOD_NO_TRANSCODE"
      ).trim(),
      vodPlayDomain: (body.vodPlayDomain ?? current.vodPlayDomain)
        .trim()
        .replace(/^https?:\/\//, ""),
    };

    if (
      !probe.vodAccessKeyId ||
      !probe.vodAccessKeySecret ||
      isMaskedPlaceholder(probe.vodAccessKeySecret)
    ) {
      return NextResponse.json(
        { error: "请先填写点播 AccessKey ID 与 Secret" },
        { status: 400 },
      );
    }

    const result = await testVodConnection(probe);
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // 测试成功时顺带把填写的非密钥字段落库（密钥仅在有新值时更新）
    const data: Record<string, string> = {
      vodRegionId: probe.vodRegionId,
      vodAccessKeyId: probe.vodAccessKeyId,
      vodTemplateGroupId: probe.vodTemplateGroupId,
      vodPlayDomain: probe.vodPlayDomain,
    };
    if (nextSecret) data.vodAccessKeySecret = nextSecret;

    const row = await prisma.siteSettings.update({
      where: { id: "default" },
      data,
    });
    invalidateSiteSettingsCache();

    return NextResponse.json({
      ok: true,
      message: result.message,
      settings: publicSiteSettings(row),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
