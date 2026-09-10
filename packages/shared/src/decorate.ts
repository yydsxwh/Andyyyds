import { DEFAULT_SITE_HERO_URL } from "@andyyyds/shared/cover-images";
import {
  DEFAULT_HOME_WIDGET_LAYOUT,
  normalizeHomeWidgetLayout,
  type HomeWidgetLayoutConfig,
} from "@andyyyds/shared/home-widget-layout";
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
} from "@andyyyds/shared/site-theme";
import {
  DEFAULT_TYPOGRAPHY,
  normalizeTypography,
  type TypographyConfig,
} from "@andyyyds/shared/site-typography";
import {
  DEFAULT_HOME_CLOCK,
  normalizeHomeClock,
  type HomeClockConfig,
} from "@andyyyds/shared/home-clock";
import {
  DEFAULT_HOME_LOGO,
  normalizeHomeLogo,
  type HomeLogoConfig,
} from "@andyyyds/shared/home-logo";

export type { HomeWidgetBox, HomeWidgetLayoutConfig } from "@andyyyds/shared/home-widget-layout";

export type DecorateBanner = {
  id: string;
  url: string;
  alt: string;
  /**
   * 点击跳转地址（站内路径或 https）。
   * 空则前台不可点，兼容旧库无此字段的配置。
   */
  href?: string;
  /**
   * 是否新标签打开。
   * 未配置时：首页主图（banners[0]）默认 true；其它横幅默认 true（投放链常见外链）。
   */
  openInNewTab?: boolean;
};

/** 首页主视觉区 CTA 按钮（站长可改文案与跳转） */
export type DecorateCta = {
  label: string;
  href: string;
  /** 未配置时同页打开，保持原先 Link 行为 */
  openInNewTab?: boolean;
};

export type DecorateConfig = {
  logoUrl: string;
  /**
   * 首页品牌 Logo 点击地址；空则不可点（顶栏 Logo 仍回首页，不受此字段影响）。
   */
  logoHref?: string;
  logoOpenInNewTab?: boolean;
  /** 浏览器标题 / 安装提示等处显示的网站名称 */
  siteName: string;
  brandName: string;
  showBrandText: boolean;
  heroHeadline: string;
  heroSubtext: string;
  /** 首页右侧主视觉；若 banners 非空则优先用 banners[0] */
  heroImageUrl: string;
  banners: DecorateBanner[];
  /** 主视觉主按钮（默认「进入知识付费」） */
  heroPrimaryCta: DecorateCta;
  /** 主视觉次按钮（默认「了解公司」） */
  heroSecondaryCta: DecorateCta;
  /** 一键主题包 id（仅记录来源；实际生效看 palette/background） */
  themePackId: string;
  /** 配色方案 id → CSS 变量 */
  paletteId: string;
  /** 背景方案 id → body 背景层 */
  backgroundId: string;
  /** 轻量版式密度 */
  layoutDensity: LayoutDensity;
  /** 各区块字号（px），站长在「网站装扮 → 文字」调整 */
  fontSizes: FontSizesConfig;
  /** 各文本角色的字体 / 特效 / 动画；缺省兼容旧 decorateJson */
  typography: TypographyConfig;
  /** 首页时钟样式与摆放；未配置时用右上默认角 */
  homeClock: HomeClockConfig;
  /** 首页颗秒标摆放与大小；始终浮动，不进门户画布 */
  homeLogo: HomeLogoConfig;
  /** 首页时钟与门户卡片的自由位置/尺寸；未启用时保持顶栏时钟 + 栅格 */
  homeWidgetLayout: HomeWidgetLayoutConfig;
};

export const DEFAULT_LOGO_URL = "/brand/logo.png";

/** 首页主视觉：本地 public/covers，与课程封面图库一致 */
const DEFAULT_HERO_IMAGE = DEFAULT_SITE_HERO_URL;

export const DEFAULT_HERO_PRIMARY_CTA: DecorateCta = {
  label: "进入知识付费",
  href: "/courses",
  openInNewTab: false,
};

export const DEFAULT_HERO_SECONDARY_CTA: DecorateCta = {
  label: "了解公司",
  href: "/about/company",
  openInNewTab: false,
};

export const DEFAULT_DECORATE: DecorateConfig = {
  logoUrl: DEFAULT_LOGO_URL,
  logoHref: "",
  logoOpenInNewTab: false,
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
      href: "",
      openInNewTab: true,
    },
  ],
  heroPrimaryCta: { ...DEFAULT_HERO_PRIMARY_CTA },
  heroSecondaryCta: { ...DEFAULT_HERO_SECONDARY_CTA },
  themePackId: DEFAULT_THEME_PACK_ID,
  paletteId: DEFAULT_PALETTE_ID,
  backgroundId: DEFAULT_BACKGROUND_ID,
  layoutDensity: DEFAULT_LAYOUT_DENSITY,
  fontSizes: { ...DEFAULT_FONT_SIZES },
  typography: structuredClone(DEFAULT_TYPOGRAPHY),
  homeClock: { ...DEFAULT_HOME_CLOCK },
  homeLogo: { ...DEFAULT_HOME_LOGO },
  homeWidgetLayout: structuredClone(DEFAULT_HOME_WIDGET_LAYOUT),
};

function newId() {
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeOptionalHref(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .slice(0, 800);
}

function normalizeCta(
  raw: Partial<DecorateCta> | undefined,
  fallback: DecorateCta,
): DecorateCta {
  const label =
    String(raw?.label ?? fallback.label)
      .trim()
      .slice(0, 40) || fallback.label;
  const href =
    String(raw?.href ?? fallback.href)
      .trim()
      .slice(0, 800) || fallback.href;
  return {
    label,
    href,
    openInNewTab:
      typeof raw?.openInNewTab === "boolean"
        ? raw.openInNewTab
        : Boolean(fallback.openInNewTab),
  };
}

export function newBanner(partial?: Partial<DecorateBanner>): DecorateBanner {
  return {
    id: partial?.id || newId(),
    url: (partial?.url || "").trim(),
    alt: (partial?.alt || "").trim(),
    href: normalizeOptionalHref(partial?.href),
    // 横幅默认可新标签；站长可在后台关掉
    openInNewTab:
      typeof partial?.openInNewTab === "boolean" ? partial.openInNewTab : true,
  };
}

/** 横幅/主图：未显式配置时默认新标签（首页大图投放链常见需求） */
export function resolveBannerOpenInNewTab(banner: DecorateBanner): boolean {
  return banner.openInNewTab !== false;
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
    typography: normalizeTypography(parsed.typography),
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
            href: normalizeOptionalHref(b.href),
            // 旧配置无 openInNewTab：主图/横幅默认新标签，填了链接即可外跳
            openInNewTab:
              typeof b.openInNewTab === "boolean" ? b.openInNewTab : true,
          }))
          .filter((b) => b.url)
      : DEFAULT_DECORATE.banners;

    const brandName =
      (parsed.brandName || DEFAULT_DECORATE.brandName).trim() || "歪歪艾斯";
    const theme = resolveThemeFields(parsed);
    return {
      logoUrl: (parsed.logoUrl || DEFAULT_DECORATE.logoUrl).trim() || DEFAULT_LOGO_URL,
      logoHref: normalizeOptionalHref(parsed.logoHref),
      logoOpenInNewTab:
        typeof parsed.logoOpenInNewTab === "boolean"
          ? parsed.logoOpenInNewTab
          : false,
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
      heroPrimaryCta: normalizeCta(
        parsed.heroPrimaryCta,
        DEFAULT_HERO_PRIMARY_CTA,
      ),
      heroSecondaryCta: normalizeCta(
        parsed.heroSecondaryCta,
        DEFAULT_HERO_SECONDARY_CTA,
      ),
      ...theme,
      homeClock: normalizeHomeClock(parsed.homeClock),
      homeLogo: normalizeHomeLogo(parsed.homeLogo),
      homeWidgetLayout: normalizeHomeWidgetLayout(parsed.homeWidgetLayout),
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
