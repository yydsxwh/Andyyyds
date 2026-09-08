/**
 * 首页颗秒标 + 额外 PNG 挂件。
 * 位置写入装扮；＋－缩放与点开后的隐藏只先改本机，站长隐藏才写库。
 */

export const HOME_LOGO_STILL_SRC = "/home-logo/kemiao.webp";
export const HOME_LOGO_STILL_FALLBACK_SRC = "/home-logo/kemiao.png";
export const HOME_LOGO_ANIM_SRC = "/home-logo/kemiao-anim.webp";
export const HOME_LOGO_ALT = "颗秒";
export const HOME_PNG_LOGO_MAX = 8;
export const HOME_PNG_LOGO_URL_MAX = 800;

export type HomePngLogo = {
  id: string;
  url: string;
  visible: boolean;
  xPercent: number | null;
  yPercent: number | null;
};

export type HomeLogoConfig = {
  visible: boolean;
  /** 距视口左边的百分比；null 表示默认左上（与时钟右上对称） */
  xPercent: number | null;
  yPercent: number | null;
  /** true 用压缩过的旋转动画；微信里 WebP 动图比 15MB GIF 可接受 */
  useAnimation: boolean;
  /** 额外 PNG/静帧挂件，和颗秒动画同时存在 */
  pngLogos: HomePngLogo[];
};

export const DEFAULT_HOME_LOGO: HomeLogoConfig = {
  visible: true,
  xPercent: null,
  yPercent: null,
  useAnimation: true,
  pngLogos: [],
};

function clampPercent(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n * 10) / 10));
}

function newPngId() {
  return `png_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeHomePngLogo(
  raw: Partial<HomePngLogo> | null | undefined,
): HomePngLogo | null {
  const url = String(raw?.url || "")
    .trim()
    .slice(0, HOME_PNG_LOGO_URL_MAX);
  if (!url) return null;
  const id = String(raw?.id || "")
    .trim()
    .slice(0, 64);
  return {
    id: id || newPngId(),
    url,
    visible: raw?.visible !== false,
    xPercent: clampPercent(raw?.xPercent),
    yPercent: clampPercent(raw?.yPercent),
  };
}

export function normalizeHomePngLogos(
  raw: unknown,
): HomePngLogo[] {
  if (!Array.isArray(raw)) return [];
  const next: HomePngLogo[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (next.length >= HOME_PNG_LOGO_MAX) break;
    const png = normalizeHomePngLogo(
      item && typeof item === "object" ? (item as Partial<HomePngLogo>) : null,
    );
    if (!png || seen.has(png.id)) continue;
    seen.add(png.id);
    next.push(png);
  }
  return next;
}

export function normalizeHomeLogo(
  raw: Partial<HomeLogoConfig> | null | undefined,
): HomeLogoConfig {
  return {
    visible: raw?.visible !== false,
    xPercent: clampPercent(raw?.xPercent),
    yPercent: clampPercent(raw?.yPercent),
    useAnimation:
      typeof raw?.useAnimation === "boolean"
        ? raw.useAnimation
        : DEFAULT_HOME_LOGO.useAnimation,
    pngLogos: normalizeHomePngLogos(raw?.pngLogos),
  };
}

function pngListEqual(a: HomePngLogo[], b: HomePngLogo[]) {
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return (
      item.id === other.id &&
      item.url === other.url &&
      item.visible === other.visible &&
      item.xPercent === other.xPercent &&
      item.yPercent === other.yPercent
    );
  });
}

export function homeLogoEqual(a: HomeLogoConfig, b: HomeLogoConfig) {
  return (
    a.visible === b.visible &&
    a.xPercent === b.xPercent &&
    a.yPercent === b.yPercent &&
    a.useAnimation === b.useAnimation &&
    pngListEqual(a.pngLogos, b.pngLogos)
  );
}

export function createHomePngLogo(url: string): HomePngLogo {
  return {
    id: newPngId(),
    url: url.trim().slice(0, HOME_PNG_LOGO_URL_MAX),
    visible: true,
    xPercent: null,
    yPercent: null,
  };
}
