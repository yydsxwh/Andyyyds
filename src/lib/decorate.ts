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
};

export const DEFAULT_LOGO_URL = "/brand/logo.png";

const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1400&q=80";

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
