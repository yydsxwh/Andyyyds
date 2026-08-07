import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  DEFAULT_DECORATE,
  parseDecorate,
  stringifyDecorate,
} from "@/lib/decorate";
import {
  DEFAULT_BACKGROUND_ID,
  DEFAULT_LAYOUT_DENSITY,
  DEFAULT_PALETTE_ID,
  backgroundById,
  normalizeFontSizes,
  normalizeLayoutDensity,
  paletteById,
  themePackById,
} from "@/lib/site-theme";
import { normalizeTypography } from "@/lib/site-typography";
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
  themePackId: z.string().max(64).optional(),
  paletteId: z.string().max(64).optional(),
  backgroundId: z.string().max(64).optional(),
  layoutDensity: z.enum(["default", "compact", "airy"]).optional(),
  fontSizes: z
    .object({
      nav: z.number().optional(),
      brand: z.number().optional(),
      heroTitle: z.number().optional(),
      heroSubtext: z.number().optional(),
      sectionTitle: z.number().optional(),
      sectionDesc: z.number().optional(),
      portalCardTitle: z.number().optional(),
      portalCardDesc: z.number().optional(),
    })
    .optional(),
  typography: z
    .record(
      z.string(),
      z.object({
        fontFamily: z.string().max(64).optional(),
        color: z.string().max(32).optional(),
        effect: z.string().max(32).optional(),
        animation: z.string().max(32).optional(),
      }),
    )
    .optional(),
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

    // 一键主题包优先：若显式传了 themePackId 且能解析，用包内配色/背景覆盖
    let themePackId = (body.themePackId ?? current.themePackId).trim();
    let paletteId = (body.paletteId ?? current.paletteId).trim();
    let backgroundId = (body.backgroundId ?? current.backgroundId).trim();
    const pack = themePackById(themePackId);
    if (body.themePackId !== undefined && pack) {
      themePackId = pack.id;
      // 仅当本次没单独改配色/背景时，才用主题包覆盖
      if (body.paletteId === undefined) paletteId = pack.paletteId;
      if (body.backgroundId === undefined) backgroundId = pack.backgroundId;
    }
    paletteId = paletteById(paletteId || DEFAULT_PALETTE_ID).id;
    backgroundId = backgroundById(backgroundId || DEFAULT_BACKGROUND_ID).id;
    const layoutDensity = normalizeLayoutDensity(
      body.layoutDensity ?? current.layoutDensity ?? DEFAULT_LAYOUT_DENSITY,
    );
    // 字号可局部 PATCH：未传的键保留库中值
    const fontSizes = normalizeFontSizes({
      ...current.fontSizes,
      ...(body.fontSizes || {}),
    });
    // 排版（字体/特效/动画）整表归一；未传则保留
    const typography = normalizeTypography(
      body.typography
        ? { ...current.typography, ...body.typography }
        : current.typography,
    );

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
      themePackId: themePackId || "",
      paletteId,
      backgroundId,
      layoutDensity,
      fontSizes,
      typography,
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
