import { sanitizeDocsContent, type DocsJsonNode } from "@andyyyds/docs/lib/docs-content";
import { docsContentToHtml } from "@andyyyds/docs/lib/docs-html";
import {
  bandCell,
  normalizePageChrome,
  type DocsPageChrome,
} from "@andyyyds/docs/lib/docs-page";
import { buildListSchemeCss, normalizeListScheme, type DocsListScheme } from "@andyyyds/docs/lib/docs-scheme";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function wrapStandaloneHtml(input: {
  title: string;
  content: DocsJsonNode;
  listScheme: DocsListScheme;
  pageChrome: DocsPageChrome;
}): string {
  const chrome = normalizePageChrome(input.pageChrome);
  const schemeCss = buildListSchemeCss(normalizeListScheme(input.listScheme));
  const body = docsContentToHtml(sanitizeDocsContent(input.content));
  const header = ["left", "center", "right"]
    .map((slot) => bandCell(chrome, "header", slot as "left", 1, 1))
    .join(" · ");
  const footer = ["left", "center", "right"]
    .map((slot) => bandCell(chrome, "footer", slot as "left", 1, 1))
    .join(" · ");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(input.title)}</title>
<style>
  body { margin: 0; color: #111; font: 16px/1.7 "PingFang SC","Microsoft YaHei",sans-serif; }
  .docs-prose { max-width: 210mm; margin: 0 auto; padding: 16mm 18mm 20mm; }
  .docs-band { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: #555; }
  .docs-band span { flex: 1; }
  .docs-band .c { text-align: center; }
  .docs-band .r { text-align: right; }
  @page { size: A4; margin: 14mm 16mm 16mm; }
  @media print {
    .docs-print-header { position: running(docs-header); }
    .docs-print-footer { position: running(docs-footer); }
    @page {
      @top-center { content: element(docs-header); }
      @bottom-center { content: element(docs-footer); }
    }
  }
  ${schemeCss}
</style>
</head>
<body>
  <header class="docs-print-header docs-band">
    <span>${escapeHtml(bandCell(chrome, "header", "left", 1, 1))}</span>
    <span class="c">${escapeHtml(bandCell(chrome, "header", "center", 1, 1))}</span>
    <span class="r">${escapeHtml(bandCell(chrome, "header", "right", 1, 1))}</span>
  </header>
  <article class="docs-prose">${body}</article>
  <footer class="docs-print-footer docs-band">
    <span>${escapeHtml(bandCell(chrome, "footer", "left", 1, 1))}</span>
    <span class="c">${escapeHtml(bandCell(chrome, "footer", "center", 1, 1))}</span>
    <span class="r">${escapeHtml(bandCell(chrome, "footer", "right", 1, 1))}</span>
  </footer>
  <!-- ${escapeHtml(header)} / ${escapeHtml(footer)} -->
</body>
</html>`;
}
