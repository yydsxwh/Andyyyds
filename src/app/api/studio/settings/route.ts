import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";
import {
  getSiteSettings,
  invalidateSiteSettingsCache,
  pickSecretUpdate,
  publicSiteSettings,
} from "@/lib/site-settings";

const patchSchema = z.object({
  siteUrl: z.string().max(300).optional(),
  paymentMode: z.enum(["auto", "mock", "wechat", "alipay", "both"]).optional(),
  wechatEnabled: z.boolean().optional(),
  alipayEnabled: z.boolean().optional(),
  wechatAppId: z.string().max(128).optional(),
  wechatMchId: z.string().max(64).optional(),
  wechatApiV3Key: z.string().max(128).optional(),
  wechatMchSerialNo: z.string().max(128).optional(),
  wechatMchPrivateKey: z.string().max(10000).optional(),
  alipayAppId: z.string().max(64).optional(),
  alipayPrivateKey: z.string().max(10000).optional(),
  alipayPublicKey: z.string().max(10000).optional(),
  alipayGateway: z.enum(["production", "sandbox"]).optional(),
  storageProvider: z.enum(["LOCAL", "ALIYUN_OSS"]).optional(),
  ossRegion: z.string().max(64).optional(),
  ossBucket: z.string().max(128).optional(),
  ossAccessKeyId: z.string().max(128).optional(),
  ossAccessKeySecret: z.string().max(128).optional(),
  ossEndpoint: z.string().max(300).optional(),
  ossPublicBaseUrl: z.string().max(300).optional(),
  ossPrefix: z.string().max(120).optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const row = await getSiteSettings();
    return NextResponse.json({ settings: publicSiteSettings(row) });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = patchSchema.parse(await req.json());
    const current = await getSiteSettings();

    const data: Record<string, unknown> = {};
    const plainKeys = [
      "siteUrl",
      "paymentMode",
      "wechatEnabled",
      "alipayEnabled",
      "wechatAppId",
      "wechatMchId",
      "wechatMchSerialNo",
      "alipayAppId",
      "alipayGateway",
      "storageProvider",
      "ossRegion",
      "ossBucket",
      "ossAccessKeyId",
      "ossEndpoint",
      "ossPublicBaseUrl",
      "ossPrefix",
    ] as const;

    for (const key of plainKeys) {
      if (body[key] !== undefined) {
        data[key] =
          typeof body[key] === "string" ? String(body[key]).trim() : body[key];
      }
    }

    const secretKeys = [
      ["wechatApiV3Key", body.wechatApiV3Key],
      ["wechatMchPrivateKey", body.wechatMchPrivateKey],
      ["alipayPrivateKey", body.alipayPrivateKey],
      ["alipayPublicKey", body.alipayPublicKey],
      ["ossAccessKeySecret", body.ossAccessKeySecret],
    ] as const;

    for (const [key, incoming] of secretKeys) {
      const currentValue = String(
        (current as unknown as Record<string, unknown>)[key] ?? "",
      );
      const next = pickSecretUpdate(incoming, currentValue);
      if (next !== undefined) data[key] = next;
    }

    if (typeof data.siteUrl === "string") {
      data.siteUrl = data.siteUrl.replace(/\/$/, "");
    }

    const row = await prisma.siteSettings.update({
      where: { id: "default" },
      data,
    });
    invalidateSiteSettingsCache();

    return NextResponse.json({ settings: publicSiteSettings(row) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
