/**
 * 首页颗秒标：静帧 + 压缩动画；位置写入装扮，全站访客同一摆放。
 * 点击后用＋－逐步缩放，只存在本机，避免一个人改大小、所有人跟着变。
 */

export const HOME_LOGO_STILL_SRC = "/home-logo/kemiao.webp";
export const HOME_LOGO_STILL_FALLBACK_SRC = "/home-logo/kemiao.png";
export const HOME_LOGO_ANIM_SRC = "/home-logo/kemiao-anim.webp";
export const HOME_LOGO_ALT = "颗秒";

export type HomeLogoConfig = {
  visible: boolean;
  /** 距视口左边的百分比；null 表示默认左上（与时钟右上对称） */
  xPercent: number | null;
  yPercent: number | null;
  /** true 用压缩过的旋转动画；微信里 WebP 动图比 15MB GIF 可接受 */
  useAnimation: boolean;
};

export const DEFAULT_HOME_LOGO: HomeLogoConfig = {
  visible: true,
  xPercent: null,
  yPercent: null,
  useAnimation: true,
};

function clampPercent(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n * 10) / 10));
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
  };
}

export function homeLogoEqual(a: HomeLogoConfig, b: HomeLogoConfig) {
  return (
    a.visible === b.visible &&
    a.xPercent === b.xPercent &&
    a.yPercent === b.yPercent &&
    a.useAnimation === b.useAnimation
  );
}
