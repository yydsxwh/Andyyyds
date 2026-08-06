import { DEFAULT_SITE_HERO_URL } from "@/lib/cover-images";
import {
  DEFAULT_BACKGROUND_ID,
  DEFAULT_FONT_SIZES,
  DEFAULT_LAYOUT_DENSITY,
  DEFAULT_PALETTE_ID,
  DEFAULT_THEME_PACK_ID,
  backgroundById,
  normalizeFontSizes,
  normalizeLayoutDensity,
  paletteById,
  themePackById,
  type FontSizesConfig,
  type LayoutDensity,
} from "@/lib/site-theme";

export type DecorateBanner = {
  id: string;
  url: string;
  alt: string;
};

export type DecorateConfig = {
  logoUrl: string;
  /** 浏览器标题 / 安装提示等处显示的网站名称 */
  siteName: string;
  brandName: string;
  showBrandText: boolean;
  heroHeadline: string;
  heroSubtext: string;
  /** 首页右侧主视觉；若 banners 非空则优先用 banners[0] */
  heroImageUrl: string;
  banners: DecorateBanner[];
  /** 一键主题包 id（仅记录来源；实际生效看 palette/background） */
  themePackId: string;
  /** 配色方案 id → CSS 变量 */
  paletteId: string;
  /** 背景方案 id → body 背景层 */
  backgroundId: string;
  /** 轻量版式密度 */
  layoutDensity: LayoutDensity;
  /** 各区块字号（px），站长在「网站装扮 → 字号」调整 */
  fontSizes: FontSizesConfig;
};

export const DEFAULT_LOGO_URL = "/brand/logo.png";

/** 首页主视觉：本地 public/covers，与课程封面图库一致 */
const DEFAULT_HERO_IMAGE = DEFAULT_SITE_HERO_URL;

export const DEFAULT_DECORATE: DecorateConfig = {
  logoUrl: DEFAULT_LOGO_URL,
  siteName: "歪歪艾斯",
  brandName: "歪歪艾斯",
  showBrandText: false,
  heroHeadline: "把你的经验，做成一门真正能卖出去的课",
  heroSubtext:
    "课程上架、支付购买、在线学习、创作者后台、优惠券与邀请分销，一站备齐。先跑通卖课闭环，再按你的业务升级改造。",
  heroImageUrl: DEFAULT_HERO_IMAGE,
  banners: [
    {
      id: "default-hero",
      url: DEFAULT_HERO_IMAGE,
      alt: "学员在线学习",
    },
  ],
  themePackId: DEFAULT_THEME_PACK_ID,
  paletteId: DEFAULT_PALETTE_ID,
  backgroundId: DEFAULT_BACKGROUND_ID,
  layoutDensity: DEFAULT_LAYOUT_DENSITY,
  fontSizes: { ...DEFAULT_FONT_SIZES },
};

function newId() {
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newBanner(partial?: Partial<DecorateBanner>): DecorateBanner {
  return {
    id: partial?.id || newId(),
    url: (partial?.url || "").trim(),
    alt: (partial?.alt || "").trim(),
  };
}

function resolveThemeFields(parsed: Partial<DecorateConfig>) {
  // 若只存了 themePackId，用主题包补齐配色/背景，保证旧数据与一键装扮一致
  const pack = themePackById(parsed.themePackId);
  const paletteId = paletteById(
    parsed.paletteId || pack?.paletteId || DEFAULT_PALETTE_ID,
  ).id;
  const backgroundId = backgroundById(
    parsed.backgroundId || pack?.backgroundId || DEFAULT_BACKGROUND_ID,
  ).id;
  const themePackId =
    (parsed.themePackId || "").trim() ||
    (pack ? pack.id : DEFAULT_THEME_PACK_ID);
  return {
    themePackId,
    paletteId,
    backgroundId,
    layoutDensity: normalizeLayoutDensity(parsed.layoutDensity),
    fontSizes: normalizeFontSizes(parsed.fontSizes),
  };
}

export function parseDecorate(raw: string | null | undefined): DecorateConfig {
  if (!raw?.trim()) return structuredClone(DEFAULT_DECORATE);
  try {
    const parsed = JSON.parse(raw) as Partial<DecorateConfig>;
    const banners = Array.isArray(parsed.banners)
      ? parsed.banners
          .filter((b): b is DecorateBanner => Boolean(b && typeof b === "object"))
          .map((b) => ({
            id: String(b.id || newId()),
            url: String(b.url || "").trim(),
            alt: String(b.alt || "").trim(),
          }))
          .filter((b) => b.url)
      : DEFAULT_DECORATE.banners;

    const brandName =
      (parsed.brandName || DEFAULT_DECORATE.brandName).trim() || "歪歪艾斯";
    const theme = resolveThemeFields(parsed);
    return {
      logoUrl: (parsed.logoUrl || DEFAULT_DECORATE.logoUrl).trim() || DEFAULT_LOGO_URL,
      siteName:
        (parsed.siteName || brandName || DEFAULT_DECORATE.siteName).trim() ||
        DEFAULT_DECORATE.siteName,
      brandName,
      showBrandText:
        typeof parsed.showBrandText === "boolean"
          ? parsed.showBrandText
          : DEFAULT_DECORATE.showBrandText,
      heroHeadline:
        (parsed.heroHeadline || DEFAULT_DECORATE.heroHeadline).trim() ||
        DEFAULT_DECORATE.heroHeadline,
      heroSubtext:
        (parsed.heroSubtext || DEFAULT_DECORATE.heroSubtext).trim() ||
        DEFAULT_DECORATE.heroSubtext,
      heroImageUrl:
        (parsed.heroImageUrl || banners[0]?.url || DEFAULT_DECORATE.heroImageUrl).trim() ||
        DEFAULT_HERO_IMAGE,
      banners: banners.length ? banners : structuredClone(DEFAULT_DECORATE.banners),
      ...theme,
    };
  } catch {
    return structuredClone(DEFAULT_DECORATE);
  }
}

export function stringifyDecorate(config: DecorateConfig) {
  return JSON.stringify(config);
}

/** 首页主视觉：优先 banners 第一张 */
export function resolveHeroImage(config: DecorateConfig) {
  return config.banners[0]?.url || config.heroImageUrl || DEFAULT_HERO_IMAGE;
}
