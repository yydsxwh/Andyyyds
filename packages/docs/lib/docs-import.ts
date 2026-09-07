/**
 * 打开 Word / WPS：服务端用 mammoth 抽 HTML，再收成文档 JSON。
 * 旧版二进制 .doc 解不了，请用户另存为 .docx。
 */

import mammoth from "mammoth";
import {
  emptyDocsContent,
  inferDocsTitle,
  sanitizeDocsContent,
  type DocsJsonNode,
} from "@andyyyds/docs/lib/docs-content";
import { importPlainOrMarkup, titleFromFileName } from "@andyyyds/docs/lib/docs-html";

export const DOCS_IMPORT_MAX_BYTES = 8 * 1024 * 1024;

export type DocsImportResult = {
  title: string;
  content: DocsJsonNode;
};

function isZip(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

function isOle(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0
  );
}

export async function importOfficeBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<DocsImportResult> {
  if (buffer.length > DOCS_IMPORT_MAX_BYTES) {
    throw new Error("文件不能超过 8MB");
  }
  if (isOle(buffer)) {
    throw new Error("旧版 .doc / .wps 打不开，请用 WPS 或 Word 另存为 .docx 再打开");
  }
  if (!isZip(buffer)) {
    throw new Error("请打开 Word / WPS（.docx）文件");
  }
  const result = await mammoth.convertToHtml({ buffer });
  const html = String(result.value || "").trim();
  const content = html
    ? importPlainOrMarkup(html, "html")
    : emptyDocsContent();
  const title = inferDocsTitle(sanitizeDocsContent(content), titleFromFileName(fileName));
  return { title, content };
}
