/**
 * 文档 JSON：只放编辑器认识的节点。存库前sanitize，避免粘贴进来的脚本/未知标记。
 */

import {
  DEFAULT_DOCS_PAGE_CHROME,
  normalizePageChrome,
  type DocsPageChrome,
} from "@andyyyds/docs/lib/docs-page";
import {
  DEFAULT_DOCS_LIST_SCHEME,
  normalizeListScheme,
  type DocsListScheme,
} from "@andyyyds/docs/lib/docs-scheme";

export const DOCS_TITLE_MAX_CHARS = 80;
export const DOCS_CONTENT_MAX_CHARS = 800_000;
export const DOCS_MAX_PER_USER = 80;
export const DOCS_LOCAL_ID = "local";
export const DOCS_LOCAL_STORAGE_KEY = "yyds-docs-local-v1";

export const DOCS_ALLOWED_NODE_TYPES = new Set([
  "doc",
  "paragraph",
  "heading",
  "text",
  "hardBreak",
  "bulletList",
  "orderedList",
  "listItem",
  "image",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
]);

export const DOCS_ALLOWED_MARK_TYPES = new Set(["bold", "italic"]);

export type DocsJsonNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocsJsonNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

export type DocsDocumentPayload = {
  id: string;
  title: string;
  content: DocsJsonNode;
  listScheme: DocsListScheme;
  pageChrome: DocsPageChrome;
  updatedAt: string;
  createdAt?: string;
};

export function emptyDocsContent(): DocsJsonNode {
  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

export function defaultDocsTitle(): string {
  return "未命名文档";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeMarks(raw: unknown): DocsJsonNode["marks"] {
  if (!Array.isArray(raw)) return undefined;
  const marks = raw
    .filter((item) => isPlainObject(item) && DOCS_ALLOWED_MARK_TYPES.has(String(item.type)))
    .map((item) => ({ type: String((item as { type: string }).type) }));
  return marks.length ? marks : undefined;
}

function sanitizeHeadingLevel(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 2;
  return Math.min(6, Math.max(1, Math.round(n)));
}

function sanitizeImageAttrs(raw: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(raw)) return undefined;
  const src = String(raw.src || "").trim();
  if (!src) return undefined;
  if (!/^(https?:\/\/|data:image\/|\/uploads\/|\/)/i.test(src)) return undefined;
  const alt = String(raw.alt || "").slice(0, 120);
  return { src, alt };
}

function sanitizeTableAttrs(raw: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(raw)) return undefined;
  const colspan = Number(raw.colspan);
  const rowspan = Number(raw.rowspan);
  const attrs: Record<string, unknown> = {};
  if (Number.isFinite(colspan) && colspan > 1) attrs.colspan = Math.min(12, Math.round(colspan));
  if (Number.isFinite(rowspan) && rowspan > 1) attrs.rowspan = Math.min(20, Math.round(rowspan));
  return Object.keys(attrs).length ? attrs : undefined;
}

export function sanitizeDocsContent(raw: unknown): DocsJsonNode {
  const walk = (node: unknown, depth: number): DocsJsonNode | null => {
    if (depth > 40 || !isPlainObject(node)) return null;
    const type = String(node.type || "");
    if (!DOCS_ALLOWED_NODE_TYPES.has(type)) return null;

    if (type === "text") {
      const text = String(node.text || "").slice(0, 20_000);
      if (!text) return null;
      return { type: "text", text, marks: sanitizeMarks(node.marks) };
    }

    if (type === "hardBreak") return { type: "hardBreak" };

    if (type === "image") {
      const attrs = sanitizeImageAttrs(node.attrs);
      if (!attrs) return null;
      return { type: "image", attrs };
    }

    const children = Array.isArray(node.content)
      ? node.content
          .map((child) => walk(child, depth + 1))
          .filter((child): child is DocsJsonNode => Boolean(child))
      : [];

    if (type === "heading") {
      return {
        type: "heading",
        attrs: { level: sanitizeHeadingLevel(isPlainObject(node.attrs) ? node.attrs.level : 2) },
        content: children.length ? children : [{ type: "text", text: "" }],
      };
    }

    if (type === "tableCell" || type === "tableHeader") {
      return {
        type,
        attrs: sanitizeTableAttrs(node.attrs),
        content: children.length ? children : [{ type: "paragraph" }],
      };
    }

    if (type === "tableRow") {
      return {
        type,
        content: children.length ? children : [{ type: "tableCell", content: [{ type: "paragraph" }] }],
      };
    }

    if (type === "table") {
      return {
        type,
        content: children.length
          ? children
          : [
              {
                type: "tableRow",
                content: [{ type: "tableCell", content: [{ type: "paragraph" }] }],
              },
            ],
      };
    }

    if (type === "listItem") {
      return {
        type,
        content: children.length ? children : [{ type: "paragraph" }],
      };
    }

    if (type === "bulletList" || type === "orderedList") {
      return {
        type,
        content: children.length ? children : [{ type: "listItem", content: [{ type: "paragraph" }] }],
      };
    }

    if (type === "doc") {
      return {
        type: "doc",
        content: children.length ? children : [{ type: "paragraph" }],
      };
    }

    return { type: "paragraph", content: children };
  };

  return walk(raw, 0) || emptyDocsContent();
}

export function extractPlainText(node: DocsJsonNode): string {
  if (node.type === "text") return node.text || "";
  if (!node.content) return "";
  return node.content.map(extractPlainText).join("");
}

export function inferDocsTitle(content: DocsJsonNode, fallback = defaultDocsTitle()): string {
  const first = content.content?.[0];
  if (!first) return fallback;
  const text = extractPlainText(first).replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.slice(0, DOCS_TITLE_MAX_CHARS);
}

export function clampDocsTitle(raw: unknown): string {
  const title = String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DOCS_TITLE_MAX_CHARS);
  return title || defaultDocsTitle();
}

export function parseStoredDocument(raw: {
  id: string;
  title: string;
  content: string;
  listScheme: string;
  pageChrome?: string | null;
  updatedAt: Date | string;
  createdAt?: Date | string;
}): DocsDocumentPayload {
  let parsed: unknown = emptyDocsContent();
  try {
    parsed = JSON.parse(raw.content);
  } catch {
    parsed = emptyDocsContent();
  }
  let scheme: unknown = DEFAULT_DOCS_LIST_SCHEME;
  try {
    scheme = JSON.parse(raw.listScheme || "{}");
  } catch {
    scheme = DEFAULT_DOCS_LIST_SCHEME;
  }
  let chrome: unknown = DEFAULT_DOCS_PAGE_CHROME;
  try {
    chrome = JSON.parse(raw.pageChrome || "{}");
  } catch {
    chrome = DEFAULT_DOCS_PAGE_CHROME;
  }
  return {
    id: raw.id,
    title: clampDocsTitle(raw.title),
    content: sanitizeDocsContent(parsed),
    listScheme: normalizeListScheme(scheme),
    pageChrome: normalizePageChrome(chrome),
    updatedAt: new Date(raw.updatedAt).toISOString(),
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : undefined,
  };
}

export function serializeDocsContent(content: DocsJsonNode): string {
  const json = JSON.stringify(sanitizeDocsContent(content));
  if (json.length > DOCS_CONTENT_MAX_CHARS) {
    throw new Error("文档内容过长，请删一些图片或表格后再保存");
  }
  return json;
}
