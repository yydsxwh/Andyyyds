"use client";

/**
 * 打印预览：按 A4 切页，每页带页眉页脚页码。
 * 微信内 window.print 常被拦，预览仍可用，并提示另存后再印。
 */

import { useEffect, useMemo, useState } from "react";
import { docsContentToHtml } from "@andyyyds/docs/lib/docs-html";
import { isWechatBrowser } from "@andyyyds/docs/lib/docs-download";
import {
  bandCell,
  normalizePageChrome,
  type DocsPageChrome,
} from "@andyyyds/docs/lib/docs-page";
import { buildListSchemeCss, type DocsListScheme } from "@andyyyds/docs/lib/docs-scheme";
import type { DocsJsonNode } from "@andyyyds/docs/lib/docs-content";

type Props = {
  title: string;
  content: DocsJsonNode;
  listScheme: DocsListScheme;
  pageChrome: DocsPageChrome;
  onClose: () => void;
};

const PAGE_BODY_PX = 820;

function estimatePages(html: string): string[] {
  const source = html.trim() || "<p></p>";
  const blocks = source.match(/<h[1-6][\s\S]*?<\/h[1-6]>|<table[\s\S]*?<\/table>|<ul[\s\S]*?<\/ul>|<ol[\s\S]*?<\/ol>|<p[\s\S]*?<\/p>/gi);
  if (!blocks?.length) return [source];
  const pages: string[] = [];
  let current = "";
  let used = 0;
  for (const block of blocks) {
    const guess = /<h[1-6]/.test(block)
      ? 56
      : /<table/.test(block)
        ? 140
        : /<img/.test(block)
          ? 220
          : /<(ul|ol)/.test(block)
            ? 28 * (block.match(/<li/gi)?.length || 1)
            : 36;
    if (current && used + guess > PAGE_BODY_PX) {
      pages.push(current);
      current = block;
      used = guess;
    } else {
      current += block;
      used += guess;
    }
  }
  if (current) pages.push(current);
  return pages.length ? pages : [source];
}

export function DocsPrintPreview({
  title,
  content,
  listScheme,
  pageChrome,
  onClose,
}: Props) {
  const chrome = normalizePageChrome(pageChrome);
  const schemeCss = useMemo(() => buildListSchemeCss(listScheme), [listScheme]);
  const html = useMemo(() => docsContentToHtml(content), [content]);
  const pages = useMemo(() => estimatePages(html), [html]);
  const [wechat, setWechat] = useState(false);

  useEffect(() => {
    setWechat(isWechatBrowser());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const printNow = () => {
    window.print();
  };

  return (
    <div
      className="docs-print-root fixed inset-0 z-[80] overflow-auto bg-black/40 px-3 py-4 sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="docs-print-title"
    >
      <div className="docs-print-toolbar mx-auto mb-3 flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl bg-white p-3">
        <h2 id="docs-print-title" className="mr-auto text-sm font-medium text-[var(--ink)]">
          打印预览 · {title}
        </h2>
        <button type="button" className="btn btn-primary min-h-11 px-4 text-sm" onClick={printNow}>
          打印
        </button>
        <button type="button" className="btn btn-secondary min-h-11 px-4 text-sm" onClick={onClose}>
          关闭
        </button>
        {wechat ? (
          <p className="w-full text-xs leading-5 text-[var(--muted)]">
            微信里常常调不起系统打印。可先看预览，或另存为 HTML / Word 后用系统浏览器打开再印。
          </p>
        ) : null}
      </div>
      <style>{schemeCss}</style>
      <div className="docs-print-sheets mx-auto flex max-w-3xl flex-col gap-4 pb-10">
        {pages.map((pageHtml, index) => (
          <section key={index} className="docs-print-page">
            <div className="docs-print-band">
              <span>{bandCell(chrome, "header", "left", index + 1, pages.length)}</span>
              <span className="c">{bandCell(chrome, "header", "center", index + 1, pages.length)}</span>
              <span className="r">{bandCell(chrome, "header", "right", index + 1, pages.length)}</span>
            </div>
            <div
              className="docs-prose docs-print-body"
              dangerouslySetInnerHTML={{ __html: pageHtml }}
            />
            <div className="docs-print-band docs-print-footer">
              <span>{bandCell(chrome, "footer", "left", index + 1, pages.length)}</span>
              <span className="c">{bandCell(chrome, "footer", "center", index + 1, pages.length)}</span>
              <span className="r">{bandCell(chrome, "footer", "right", index + 1, pages.length)}</span>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
