import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@andyyyds/shared/db";
import {
  DEFAULT_DECORATE,
  parseDecorate,
  stringifyDecorate,
} from "@andyyyds/shared/decorate";
import { normalizeHomeWidgetLayout } from "@andyyyds/shared/home-widget-layout";
import {
  DEFAULT_BACKGROUND_ID,
  DEFAULT_LAYOUT_DENSITY,
  DEFAULT_PALETTE_ID,
  backgroundById,
  normalizeFontSizes,
  normalizeLayoutDensity,
  paletteById,
  themePackById,
} from "@andyyyds/shared/site-theme";
import { normalizeTypography } from "@andyyyds/shared/site-typography";
import {
  HOME_CLOCK_STYLES,
  normalizeHomeClock,
} from "@andyyyds/shared/home-clock";
import {
  HOME_LOGO_SCALE_MAX,
  HOME_LOGO_SCALE_MIN,
  normalizeHomeLogo,
} from "@andyyyds/shared/home-logo";
import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";
import {
  getSiteSettings,
  invalidateSiteSettingsCache,
} from "@andyyyds/shared/site-settings";

const bannerSchema = z.object({
  id: z.string().min(1).max(64),
  url: z.string().min(1).max(800),
  alt: z.string().max(120).optional(),
  href: z.string().max(800).optional(),
  openInNewTab: z.boolean().optional(),
});

const ctaSchema = z.object({
  label: z.string().min(1).max(40),
  href: z.string().min(1).max(800),
  openInNewTab: z.boolean().optional(),
});

const patchSchema = z.object({
  logoUrl: z.string().max(800).optional(),
  logoHref: z.string().max(800).optional(),
  logoOpenInNewTab: z.boolean().optional(),
  siteName: z.string().max(80).optional(),
  brandName: z.string().max(80).optional(),
  showBrandText: z.boolean().optional(),
  heroHeadline: z.string().max(200).optional(),
  heroSubtext: z.string().max(500).optional(),
  heroImageUrl: z.string().max(800).optional(),
  banners: z.array(bannerSchema).max(20).optional(),
  heroPrimaryCta: ctaSchema.optional(),
  heroSecondaryCta: ctaSchema.optional(),
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
      filterTag: z.number().optional(),
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
  homeClock: z
    .object({
      style: z.enum(HOME_CLOCK_STYLES).optional(),
      xPercent: z.number().min(0).max(100).nullable().optional(),
      yPercent: z.number().min(0).max(100).nullable().optional(),
      showDigital: z.boolean().optional(),
      showProverb: z.boolean().optional(),
      visible: z.boolean().optional(),
    })
    .optional(),
  homeLogo: z
    .object({
      visible: z.boolean().optional(),
      xPercent: z.number().min(0).max(100).nullable().optional(),
      yPercent: z.number().min(0).max(100).nullable().optional(),
      scale: z.number().min(HOME_LOGO_SCALE_MIN).max(HOME_LOGO_SCALE_MAX).optional(),
      useAnimation: z.boolean().optional(),
      pngLogos: z
        .array(
          z.object({
            id: z.string().min(1).max(64),
            url: z.string().min(1).max(800),
            visible: z.boolean().optional(),
            xPercent: z.number().min(0).max(100).nullable().optional(),
            yPercent: z.number().min(0).max(100).nullable().optional(),
            scale: z.number().min(HOME_LOGO_SCALE_MIN).max(HOME_LOGO_SCALE_MAX).optional(),
          }),
        )
        .max(8)
        .optional(),
    })
    .optional(),
  homeWidgetLayout: z
    .object({
      enabled: z.boolean().optional(),
      canvasMinHeightPx: z.number().optional(),
      items: z
        .record(
          z.string(),
          z.object({
            xPct: z.number(),
            yPx: z.number(),
            wPct: z.number(),
            hPx: z.number(),
          }),
        )
        .optional(),
    })
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
        href: (b.href || "").trim().slice(0, 800),
        // 未传时保留旧值；全新项默认新标签（主图投放链）
        openInNewTab:
          typeof b.openInNewTab === "boolean" ? b.openInNewTab : true,
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
    const homeClock = normalizeHomeClock({
      ...current.homeClock,
      ...(body.homeClock || {}),
    });
    const homeLogo = normalizeHomeLogo({
      ...current.homeLogo,
      ...(body.homeLogo || {}),
    });
    // 局部 PATCH 不传此字段时保留库中摆放，避免主题/门面保存把布局冲掉
    const homeWidgetLayout = normalizeHomeWidgetLayout(
      body.homeWidgetLayout ?? current.homeWidgetLayout,
    );

    const next = {
      logoUrl: (body.logoUrl ?? current.logoUrl).trim() || DEFAULT_DECORATE.logoUrl,
      logoHref: (body.logoHref ?? current.logoHref ?? "").trim().slice(0, 800),
      logoOpenInNewTab:
        body.logoOpenInNewTab ?? current.logoOpenInNewTab ?? false,
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
      heroPrimaryCta: body.heroPrimaryCta
        ? {
            label: body.heroPrimaryCta.label.trim(),
            href: body.heroPrimaryCta.href.trim(),
            openInNewTab: Boolean(body.heroPrimaryCta.openInNewTab),
          }
        : current.heroPrimaryCta,
      heroSecondaryCta: body.heroSecondaryCta
        ? {
            label: body.heroSecondaryCta.label.trim(),
            href: body.heroSecondaryCta.href.trim(),
            openInNewTab: Boolean(body.heroSecondaryCta.openInNewTab),
          }
        : current.heroSecondaryCta,
      themePackId: themePackId || "",
      paletteId,
      backgroundId,
      layoutDensity,
      fontSizes,
      typography,
      homeClock,
      homeLogo,
      homeWidgetLayout,
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
