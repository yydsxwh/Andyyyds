/**
 * 首页时钟：样式与摆放写入装扮，全站访客看到同一套。
 * 位置用视口百分比，方便窄屏和桌面共用；未拖过则沿用右上默认角。
 */

export const HOME_CLOCK_STYLES = [
  "imperial",
  "obsidian",
  "champagne",
  "emerald",
  "sapphire",
  "rose",
  "ivory",
  "platinum",
  "burgundy",
] as const;

export type HomeClockStyle = (typeof HOME_CLOCK_STYLES)[number];

export type HomeClockConfig = {
  style: HomeClockStyle;
  /** 距视口左边的百分比；null 表示仍用顶栏右下默认角 */
  xPercent: number | null;
  /** 距视口顶边的百分比 */
  yPercent: number | null;
  showDigital: boolean;
  showProverb: boolean;
  /** false 后首页不画时钟；点开后的「隐藏」站长会写这个 */
  visible: boolean;
};

export const DEFAULT_HOME_CLOCK: HomeClockConfig = {
  style: "imperial",
  xPercent: null,
  yPercent: null,
  showDigital: true,
  showProverb: true,
  visible: true,
};

export const HOME_CLOCK_STYLE_META: Record<
  HomeClockStyle,
  { name: string; hint: string }
> = {
  imperial: { name: "皇家金", hint: "品牌金表圈，气派端正" },
  obsidian: { name: "墨金", hint: "玄黑底托足金，晚宴感" },
  champagne: { name: "香槟金", hint: "暖金与奶油面，宴会灯光" },
  emerald: { name: "祖母绿", hint: "深林绿配金钉，珠宝柜气质" },
  sapphire: { name: "蓝宝石", hint: "午夜蓝与铂金针，冷冽贵气" },
  rose: { name: "玫瑰金", hint: "墨底玫瑰金，时装周质感" },
  ivory: { name: "象牙珐琅", hint: "牙白珐琅面，酒店大堂钟" },
  platinum: { name: "铂金月白", hint: "冷白金与冰丝面，珠宝店橱窗" },
  burgundy: { name: "勃艮第金", hint: "酒红丝绒面配足金，夜宴礼宾" },
};

export function isHomeClockStyle(value: string): value is HomeClockStyle {
  return (HOME_CLOCK_STYLES as readonly string[]).includes(value);
}

function clampPercent(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n * 10) / 10));
}

export function normalizeHomeClock(
  raw: Partial<HomeClockConfig> | null | undefined,
): HomeClockConfig {
  const style = isHomeClockStyle(String(raw?.style || ""))
    ? raw!.style!
    : DEFAULT_HOME_CLOCK.style;
  return {
    style,
    xPercent: clampPercent(raw?.xPercent),
    yPercent: clampPercent(raw?.yPercent),
    showDigital:
      typeof raw?.showDigital === "boolean"
        ? raw.showDigital
        : DEFAULT_HOME_CLOCK.showDigital,
    showProverb:
      typeof raw?.showProverb === "boolean"
        ? raw.showProverb
        : DEFAULT_HOME_CLOCK.showProverb,
    visible: raw?.visible !== false,
  };
}

export function homeClockEqual(a: HomeClockConfig, b: HomeClockConfig): boolean {
  return (
    a.style === b.style &&
    a.xPercent === b.xPercent &&
    a.yPercent === b.yPercent &&
    a.showDigital === b.showDigital &&
    a.showProverb === b.showProverb &&
    a.visible === b.visible
  );
}
