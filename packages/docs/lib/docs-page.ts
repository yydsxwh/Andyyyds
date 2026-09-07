/**
 * 页眉 / 页脚 / 页码。规则集中在这里，打印预览和另存为共用同一套。
 */

export const DOCS_PAGE_TEXT_MAX = 40;
export const DOCS_PAGE_NUMBER_SLOTS = [
  "none",
  "header-left",
  "header-center",
  "header-right",
  "footer-left",
  "footer-center",
  "footer-right",
] as const;

export type DocsPageNumberSlot = (typeof DOCS_PAGE_NUMBER_SLOTS)[number];

export type DocsPageChrome = {
  headerLeft: string;
  headerCenter: string;
  headerRight: string;
  footerLeft: string;
  footerCenter: string;
  footerRight: string;
  pageNumber: DocsPageNumberSlot;
  /** 首页显示的页码，默认 1 */
  startAt: number;
};

export const DEFAULT_DOCS_PAGE_CHROME: DocsPageChrome = {
  headerLeft: "",
  headerCenter: "",
  headerRight: "",
  footerLeft: "",
  footerCenter: "",
  footerRight: "",
  pageNumber: "footer-center",
  startAt: 1,
};

export const DOCS_PAGE_NUMBER_LABEL: Record<DocsPageNumberSlot, string> = {
  none: "不显示页码",
  "header-left": "页眉左侧",
  "header-center": "页眉中间",
  "header-right": "页眉右侧",
  "footer-left": "页脚左侧",
  "footer-center": "页脚中间",
  "footer-right": "页脚右侧",
};

function clampPageText(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f]/g, "")
    .slice(0, DOCS_PAGE_TEXT_MAX);
}

function clampStartAt(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(9999, Math.max(1, Math.round(n)));
}

export function normalizePageChrome(raw: unknown): DocsPageChrome {
  const input = raw && typeof raw === "object" ? (raw as Partial<DocsPageChrome>) : {};
  const slot = DOCS_PAGE_NUMBER_SLOTS.includes(input.pageNumber as DocsPageNumberSlot)
    ? (input.pageNumber as DocsPageNumberSlot)
    : DEFAULT_DOCS_PAGE_CHROME.pageNumber;
  return {
    headerLeft: clampPageText(input.headerLeft),
    headerCenter: clampPageText(input.headerCenter),
    headerRight: clampPageText(input.headerRight),
    footerLeft: clampPageText(input.footerLeft),
    footerCenter: clampPageText(input.footerCenter),
    footerRight: clampPageText(input.footerRight),
    pageNumber: slot,
    startAt: clampStartAt(input.startAt),
  };
}

export type DocsBandSlot = "left" | "center" | "right";

export function pageNumberText(chrome: DocsPageChrome, page: number, total: number): string {
  const n = chrome.startAt + page - 1;
  return `${n} / ${chrome.startAt + total - 1}`;
}

export function bandCell(
  chrome: DocsPageChrome,
  band: "header" | "footer",
  slot: DocsBandSlot,
  page: number,
  total: number,
): string {
  const key = `${band}-${slot}` as DocsPageNumberSlot;
  const text =
    band === "header"
      ? slot === "left"
        ? chrome.headerLeft
        : slot === "center"
          ? chrome.headerCenter
          : chrome.headerRight
      : slot === "left"
        ? chrome.footerLeft
        : slot === "center"
          ? chrome.footerCenter
          : chrome.footerRight;
  if (chrome.pageNumber === key) return pageNumberText(chrome, page, total);
  return text;
}

export function hasPageChrome(chrome: DocsPageChrome): boolean {
  return Boolean(
    chrome.headerLeft ||
      chrome.headerCenter ||
      chrome.headerRight ||
      chrome.footerLeft ||
      chrome.footerCenter ||
      chrome.footerRight ||
      chrome.pageNumber !== "none",
  );
}

export function safeDownloadName(title: string, ext: string): string {
  const base = title.replace(/[\\/:*?"<>|]+/g, "_").trim() || "文档";
  return `${base.slice(0, 60)}.${ext}`;
}
