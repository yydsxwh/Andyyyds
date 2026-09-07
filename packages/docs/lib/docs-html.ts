/**
 * 文档 JSON ↔ HTML / 纯文本。打开本地文件、另存、打印预览都走这里。
 * 不引入 Prisma。
 */

import {
  emptyDocsContent,
  extractPlainText,
  sanitizeDocsContent,
  type DocsJsonNode,
} from "@andyyyds/docs/lib/docs-content";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarks(text: string, marks?: DocsJsonNode["marks"]): string {
  let html = escapeHtml(text);
  if (!marks) return html;
  if (marks.some((mark) => mark.type === "italic")) html = `<em>${html}</em>`;
  if (marks.some((mark) => mark.type === "bold")) html = `<strong>${html}</strong>`;
  return html;
}

function renderInline(nodes?: DocsJsonNode[]): string {
  if (!nodes) return "";
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "<br>";
      if (node.type === "text") return renderMarks(node.text || "", node.marks);
      return renderInline(node.content);
    })
    .join("");
}

function renderBlocks(nodes?: DocsJsonNode[]): string {
  if (!nodes) return "";
  return nodes.map(renderBlock).join("");
}

function renderBlock(node: DocsJsonNode): string {
  if (node.type === "heading") {
    const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 2));
    return `<h${level}>${renderInline(node.content) || "&nbsp;"}</h${level}>`;
  }
  if (node.type === "paragraph") {
    return `<p>${renderInline(node.content) || "&nbsp;"}</p>`;
  }
  if (node.type === "bulletList") {
    return `<ul>${(node.content || [])
      .map((item) => `<li>${renderBlocks(item.content)}</li>`)
      .join("")}</ul>`;
  }
  if (node.type === "orderedList") {
    return `<ol>${(node.content || [])
      .map((item) => `<li>${renderBlocks(item.content)}</li>`)
      .join("")}</ol>`;
  }
  if (node.type === "image") {
    const src = escapeHtml(String(node.attrs?.src || ""));
    const alt = escapeHtml(String(node.attrs?.alt || ""));
    if (!src) return "";
    return `<p><img src="${src}" alt="${alt}"></p>`;
  }
  if (node.type === "table") {
    const rows = (node.content || [])
      .map((row) => {
        const cells = (row.content || [])
          .map((cell) => {
            const tag = cell.type === "tableHeader" ? "th" : "td";
            return `<${tag}>${renderBlocks(cell.content)}</${tag}>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
    return `<table>${rows}</table>`;
  }
  return renderBlocks(node.content);
}

export function docsContentToHtml(content: DocsJsonNode): string {
  const clean = sanitizeDocsContent(content);
  return renderBlocks(clean.content) || "<p></p>";
}

export function docsContentToPlainText(content: DocsJsonNode): string {
  return extractPlainText(sanitizeDocsContent(content)).replace(/\n{3,}/g, "\n\n").trim();
}

function textToParagraphs(text: string): DocsJsonNode[] {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const nodes = blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => ({
      type: "paragraph" as const,
      content: block.split("\n").flatMap((line, index) => {
        const piece: DocsJsonNode[] = [{ type: "text", text: line }];
        if (index < block.split("\n").length - 1) piece.push({ type: "hardBreak" });
        return piece;
      }),
    }));
  return nodes.length ? nodes : [{ type: "paragraph" }];
}

function markdownToNodes(text: string): DocsJsonNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: DocsJsonNode[] = [];
  let list: { type: "bulletList" | "orderedList"; items: DocsJsonNode[] } | null = null;

  const flushList = () => {
    if (!list) return;
    out.push({ type: list.type, content: list.items });
    list = null;
  };

  for (const raw of lines) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(raw);
    if (heading) {
      flushList();
      out.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: [{ type: "text", text: heading[2].trim() }],
      });
      continue;
    }
    const bullet = /^\s*[-*+]\s+(.+)$/.exec(raw);
    if (bullet) {
      if (list?.type !== "bulletList") {
        flushList();
        list = { type: "bulletList", items: [] };
      }
      list.items.push({
        type: "listItem",
        content: [{ type: "paragraph", content: [{ type: "text", text: bullet[1] }] }],
      });
      continue;
    }
    const numbered = /^\s*\d+[.)、]\s+(.+)$/.exec(raw);
    if (numbered) {
      if (list?.type !== "orderedList") {
        flushList();
        list = { type: "orderedList", items: [] };
      }
      list.items.push({
        type: "listItem",
        content: [{ type: "paragraph", content: [{ type: "text", text: numbered[1] }] }],
      });
      continue;
    }
    flushList();
    if (!raw.trim()) continue;
    out.push({
      type: "paragraph",
      content: [{ type: "text", text: raw.trim() }],
    });
  }
  flushList();
  return out.length ? out : [{ type: "paragraph" }];
}

function stripScripts(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

function htmlToNodes(html: string): DocsJsonNode[] {
  const clean = stripScripts(html);
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(clean)?.[1] || clean;
  const text = body
    .replace(/<\/(p|div|h[1-6]|li|tr|table|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<h([1-6])[^>]*>/gi, (_, level) => `${"#".repeat(Number(level))} `)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');
  return markdownToNodes(text);
}

export function importPlainOrMarkup(text: string, kind: "txt" | "md" | "html"): DocsJsonNode {
  const nodes =
    kind === "html" ? htmlToNodes(text) : kind === "md" ? markdownToNodes(text) : textToParagraphs(text);
  return sanitizeDocsContent({ type: "doc", content: nodes }) || emptyDocsContent();
}

export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim() || "导入文档";
}
