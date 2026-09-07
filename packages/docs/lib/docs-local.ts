/**
 * 未登录时的浏览器草稿。不进云端，避免游客文档占库。
 */

import {
  clampDocsTitle,
  defaultDocsTitle,
  DOCS_LOCAL_ID,
  DOCS_LOCAL_STORAGE_KEY,
  emptyDocsContent,
  sanitizeDocsContent,
  type DocsDocumentPayload,
  type DocsJsonNode,
} from "@andyyyds/docs/lib/docs-content";
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

export function emptyLocalDocument(): DocsDocumentPayload {
  const now = new Date().toISOString();
  return {
    id: DOCS_LOCAL_ID,
    title: defaultDocsTitle(),
    content: emptyDocsContent(),
    listScheme: DEFAULT_DOCS_LIST_SCHEME,
    pageChrome: DEFAULT_DOCS_PAGE_CHROME,
    updatedAt: now,
    createdAt: now,
  };
}

export function loadLocalDocument(): DocsDocumentPayload {
  try {
    const raw = localStorage.getItem(DOCS_LOCAL_STORAGE_KEY);
    if (!raw) return emptyLocalDocument();
    const parsed = JSON.parse(raw) as Partial<DocsDocumentPayload>;
    return {
      id: DOCS_LOCAL_ID,
      title: clampDocsTitle(parsed.title),
      content: sanitizeDocsContent(parsed.content),
      listScheme: normalizeListScheme(parsed.listScheme),
      pageChrome: normalizePageChrome(parsed.pageChrome),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      createdAt: parsed.createdAt,
    };
  } catch {
    return emptyLocalDocument();
  }
}

export function saveLocalDocument(input: {
  title: string;
  content: DocsJsonNode;
  listScheme: DocsListScheme;
  pageChrome: DocsPageChrome;
}): DocsDocumentPayload {
  const now = new Date().toISOString();
  const doc: DocsDocumentPayload = {
    id: DOCS_LOCAL_ID,
    title: clampDocsTitle(input.title),
    content: sanitizeDocsContent(input.content),
    listScheme: normalizeListScheme(input.listScheme),
    pageChrome: normalizePageChrome(input.pageChrome),
    updatedAt: now,
  };
  localStorage.setItem(DOCS_LOCAL_STORAGE_KEY, JSON.stringify(doc));
  return doc;
}

export function hasLocalDocument(): boolean {
  try {
    return Boolean(localStorage.getItem(DOCS_LOCAL_STORAGE_KEY));
  } catch {
    return false;
  }
}
