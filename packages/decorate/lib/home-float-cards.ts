/**
 * 首页内容卡片（找人私聊 / 联系我们 / 客户端下载）的自由摆放。
 * 与时钟挂件同一套交互：站长拖位置写库，所有人可见；
 * 点卡片空白处弹＋－调大小。与挂件不同的是卡片大小也写库——
 * 访客看到的卡片位置和大小与站长摆放的完全一致。
 * xPercent/yPercent 为 null 表示未摆放，卡片留在原文档流位置。
 */

export const HOME_FLOAT_CARD_IDS = [
  "chatSearch",
  "contact",
  "downloads",
] as const;

export type HomeFloatCardId = (typeof HOME_FLOAT_CARD_IDS)[number];

export function isHomeFloatCardId(id: string): id is HomeFloatCardId {
  return (HOME_FLOAT_CARD_IDS as readonly string[]).includes(id);
}

export const HOME_FLOAT_CARD_SCALE_MIN = 0.5;
export const HOME_FLOAT_CARD_SCALE_MAX = 2.5;
export const HOME_FLOAT_CARD_SCALE_STEP = 0.1;

/** 浮动时各卡片的基础宽度（px）；实际宽度 = 基础 × 缩放，再封顶视口 */
export const HOME_FLOAT_CARD_BASE_WIDTH_PX: Record<HomeFloatCardId, number> = {
  chatSearch: 720,
  contact: 460,
  downloads: 380,
};

export type HomeFloatCardPlacement = {
  /** 相对视口宽度的左边距（%）；null = 未摆放（留在文档流） */
  xPercent: number | null;
  /** 相对视口高度的上边距（%） */
  yPercent: number | null;
  /** 卡片大小倍数；写库让所有人看到同一尺寸 */
  scale: number;
};

export type HomeFloatCardsConfig = Partial<
  Record<HomeFloatCardId, HomeFloatCardPlacement>
>;

export const DEFAULT_HOME_FLOAT_CARDS: HomeFloatCardsConfig = {};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function asFiniteNumber(raw: unknown, fallback: number) {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeHomeFloatCardScale(raw: unknown): number {
  const n = asFiniteNumber(raw, 1);
  return (
    Math.round(
      clamp(n, HOME_FLOAT_CARD_SCALE_MIN, HOME_FLOAT_CARD_SCALE_MAX) * 10,
    ) / 10
  );
}

/** 位置成对生效：只给一个坐标时视为未摆放，避免半摆状态 */
export function normalizeHomeFloatCardPlacement(
  raw: Partial<HomeFloatCardPlacement> | undefined | null,
): HomeFloatCardPlacement {
  const hasPlace =
    raw?.xPercent != null &&
    raw?.yPercent != null &&
    Number.isFinite(Number(raw.xPercent)) &&
    Number.isFinite(Number(raw.yPercent));
  const x = hasPlace ? clamp(asFiniteNumber(raw!.xPercent, 0), 0, 100) : null;
  const y = hasPlace ? clamp(asFiniteNumber(raw!.yPercent, 0), 0, 100) : null;
  return {
    xPercent: x == null ? null : Math.round(x * 10) / 10,
    yPercent: y == null ? null : Math.round(y * 10) / 10,
    scale: normalizeHomeFloatCardScale(raw?.scale),
  };
}

export function isHomeFloatCardPlaced(
  placement: HomeFloatCardPlacement | null | undefined,
) {
  return Boolean(
    placement && placement.xPercent != null && placement.yPercent != null,
  );
}

export function normalizeHomeFloatCards(raw: unknown): HomeFloatCardsConfig {
  const out: HomeFloatCardsConfig = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isHomeFloatCardId(id)) continue;
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    out[id] = normalizeHomeFloatCardPlacement(
      value as Partial<HomeFloatCardPlacement>,
    );
  }
  return out;
}

/** 浮动渲染宽度：基础 × 缩放（组件里再用 CSS 封顶视口宽） */
export function homeFloatCardWidthPx(
  cardId: HomeFloatCardId,
  scale: number,
) {
  return Math.round(HOME_FLOAT_CARD_BASE_WIDTH_PX[cardId] * scale);
}
