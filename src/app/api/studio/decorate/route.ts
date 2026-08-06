import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  DEFAULT_DECORATE,
  parseDecorate,
  stringifyDecorate,
} from "@/lib/decorate";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";
import {
  getSiteSettings,
  invalidateSiteSettingsCache,
} from "@/lib/site-settings";

const bannerSchema = z.object({
  id: z.string().min(1).max(64),
  url: z.string().min(1).max(800),
  alt: z.string().max(120).optional(),
});

const patchSchema = z.object({
  logoUrl: z.string().max(800).optional(),
  siteName: z.string().max(80).optional(),
  brandName: z.string().max(80).optional(),
  showBrandText: z.boolean().optional(),
  heroHeadline: z.string().max(200).optional(),
  heroSubtext: z.string().max(500).optional(),
  heroImageUrl: z.string().max(800).optional(),
  banners: z.array(bannerSchema).max(20).optional(),
});

export async function GET() {
  try {
    await requireAdmin();
    const row = await getSiteSettings();
    return NextResponse.json({
      decorate: parseDecorate(row.decorateJson),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const body = patchSchema.parse(await req.json());
    const current = parseDecorate((await getSiteSettings()).decorateJson);

    const banners = (body.banners ?? current.banners)
      .map((b) => ({
        id: b.id,
        url: b.url.trim(),
        alt: (b.alt || "").trim(),
      }))
      .filter((b) => b.url);

    const brandName =
      (body.brandName ?? current.brandName).trim() || DEFAULT_DECORATE.brandName;
    const next = {
      logoUrl: (body.logoUrl ?? current.logoUrl).trim() || DEFAULT_DECORATE.logoUrl,
      siteName:
        (body.siteName ?? current.siteName ?? brandName).trim() ||
        DEFAULT_DECORATE.siteName,
      brandName,
      showBrandText: body.showBrandText ?? current.showBrandText,
      heroHeadline:
        (body.heroHeadline ?? current.heroHeadline).trim() ||
        DEFAULT_DECORATE.heroHeadline,
      heroSubtext:
        (body.heroSubtext ?? current.heroSubtext).trim() ||
        DEFAULT_DECORATE.heroSubtext,
      heroImageUrl:
        (body.heroImageUrl ?? banners[0]?.url ?? current.heroImageUrl).trim() ||
        DEFAULT_DECORATE.heroImageUrl,
      banners: banners.length ? banners : structuredClone(DEFAULT_DECORATE.banners),
    };

    const row = await prisma.siteSettings.update({
      where: { id: "default" },
      data: { decorateJson: stringifyDecorate(next) },
    });
    invalidateSiteSettingsCache();

    return NextResponse.json({
      decorate: parseDecorate(row.decorateJson),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "参数无效" }, { status: 400 });
    }
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
