/**
 * 首页时钟 + 门户入口卡片的自由摆放。
 * 存在 decorateJson，是因为装扮页改的是「门面元件位置/尺寸」，不是页面模板模块树。
 */

export const HOME_WIDGET_CLOCK_ID = "clock";
export const HOME_WIDGET_NAV_PREFIX = "nav:";

/** 触控可点的最小高度；再矮微信里很难拖、也难看清标题 */
export const HOME_WIDGET_MIN_H_PX = 56;
export const HOME_WIDGET_MAX_H_PX = 720;
export const HOME_WIDGET_MIN_W_PCT = 12;
export const HOME_WIDGET_MAX_W_PCT = 100;
export const HOME_WIDGET_MAX_Y_PX = 4000;
export const HOME_WIDGET_MAX_ITEMS = 40;
export const HOME_WIDGET_DEFAULT_CANVAS_MIN_HEIGHT_PX = 520;
export const HOME_WIDGET_CANVAS_PADDING_PX = 24;

export type HomeWidgetBox = {
  /** 相对画布宽度的左边距（%） */
  xPct: number;
  /** 相对画布顶部的上边距（px），拖动时与指针 1:1 */
  yPx: number;
  /** 相对画布宽度（%） */
  wPct: number;
  /** 高度（px），避免窄屏把文案压没 */
  hPx: number;
};

export type HomeWidgetLayoutConfig = {
  /**
   * true 后首页按画布绝对定位；时钟离开顶栏，避免两套坐标系对不齐。
   * 默认 false，旧站点保持栅格卡片 + 顶栏时钟。
   */
  enabled: boolean;
  canvasMinHeightPx: number;
  items: Record<string, HomeWidgetBox>;
};

export const DEFAULT_HOME_WIDGET_LAYOUT: HomeWidgetLayoutConfig = {
  enabled: false,
  canvasMinHeightPx: HOME_WIDGET_DEFAULT_CANVAS_MIN_HEIGHT_PX,
  items: {},
};

export function homeWidgetNavId(navKey: string) {
  return `${HOME_WIDGET_NAV_PREFIX}${navKey}`;
}

export function isHomeWidgetNavId(id: string) {
  return id.startsWith(HOME_WIDGET_NAV_PREFIX);
}

export function homeWidgetNavKey(id: string) {
  return isHomeWidgetNavId(id) ? id.slice(HOME_WIDGET_NAV_PREFIX.length) : "";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function asFiniteNumber(raw: unknown, fallback: number) {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function clampHomeWidgetBox(raw: Partial<HomeWidgetBox> | undefined): HomeWidgetBox {
  // 先钉住左边，再把宽度收到画布内，避免拉宽时整张卡片被挤到左边跳一下
  let xPct = clamp(
    asFiniteNumber(raw?.xPct, 2),
    0,
    100 - HOME_WIDGET_MIN_W_PCT,
  );
  let wPct = clamp(
    asFiniteNumber(raw?.wPct, 47),
    HOME_WIDGET_MIN_W_PCT,
    HOME_WIDGET_MAX_W_PCT,
  );
  if (xPct + wPct > 100) {
    wPct = clamp(100 - xPct, HOME_WIDGET_MIN_W_PCT, HOME_WIDGET_MAX_W_PCT);
    xPct = clamp(xPct, 0, 100 - wPct);
  }
  const hPx = clamp(
    asFiniteNumber(raw?.hPx, 96),
    HOME_WIDGET_MIN_H_PX,
    HOME_WIDGET_MAX_H_PX,
  );
  const yPx = clamp(asFiniteNumber(raw?.yPx, 0), 0, HOME_WIDGET_MAX_Y_PX);
  return {
    xPct: Math.round(xPct * 10) / 10,
    yPx: Math.round(yPx),
    wPct: Math.round(wPct * 10) / 10,
    hPx: Math.round(hPx),
  };
}

export function homeWidgetBoxStyle(box: HomeWidgetBox): {
  left: string;
  top: number;
  width: string;
  height: number;
} {
  return {
    left: `${box.xPct}%`,
    top: box.yPx,
    width: `${box.wPct}%`,
    height: box.hPx,
  };
}

/** 门户卡片默认两列，贴近手机微信；时钟默认画布右上 */
export function defaultHomeWidgetBoxes(
  navKeys: string[],
): Record<string, HomeWidgetBox> {
  const items: Record<string, HomeWidgetBox> = {
    [HOME_WIDGET_CLOCK_ID]: clampHomeWidgetBox({
      xPct: 68,
      yPx: 8,
      wPct: 30,
      hPx: 92,
    }),
  };
  navKeys.forEach((key, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    items[homeWidgetNavId(key)] = clampHomeWidgetBox({
      xPct: col === 0 ? 2 : 51,
      yPx: 112 + row * 108,
      wPct: 47,
      hPx: 96,
    });
  });
  return items;
}

export function resolveCanvasMinHeightPx(
  items: Record<string, HomeWidgetBox>,
  storedMinHeightPx?: number,
) {
  let maxBottom = HOME_WIDGET_DEFAULT_CANVAS_MIN_HEIGHT_PX;
  for (const box of Object.values(items)) {
    maxBottom = Math.max(maxBottom, box.yPx + box.hPx + HOME_WIDGET_CANVAS_PADDING_PX);
  }
  const stored = clamp(
    asFiniteNumber(storedMinHeightPx, maxBottom),
    200,
    HOME_WIDGET_MAX_Y_PX + HOME_WIDGET_MAX_H_PX,
  );
  return Math.max(stored, maxBottom);
}

/**
 * 已保存的盒子优先；新导航项补默认格，避免 CMS 加入口后画布缺卡片。
 */
export function mergeHomeWidgetBoxes(
  saved: Record<string, HomeWidgetBox> | undefined,
  navKeys: string[],
): Record<string, HomeWidgetBox> {
  const defaults = defaultHomeWidgetBoxes(navKeys);
  const next: Record<string, HomeWidgetBox> = {};
  for (const [id, box] of Object.entries(defaults)) {
    next[id] = saved?.[id] ? clampHomeWidgetBox(saved[id]) : box;
  }
  return next;
}

export function normalizeHomeWidgetLayout(
  raw: Partial<HomeWidgetLayoutConfig> | undefined,
): HomeWidgetLayoutConfig {
  const items: Record<string, HomeWidgetBox> = {};
  const source =
    raw?.items && typeof raw.items === "object" && !Array.isArray(raw.items)
      ? raw.items
      : {};
  for (const [rawId, rawBox] of Object.entries(source)) {
    if (Object.keys(items).length >= HOME_WIDGET_MAX_ITEMS) break;
    const id = String(rawId || "")
      .trim()
      .slice(0, 64);
    if (!id) continue;
    if (id !== HOME_WIDGET_CLOCK_ID && !isHomeWidgetNavId(id)) continue;
    items[id] = clampHomeWidgetBox(rawBox);
  }
  return {
    enabled: raw?.enabled === true,
    canvasMinHeightPx: resolveCanvasMinHeightPx(items, raw?.canvasMinHeightPx),
    items,
  };
}
