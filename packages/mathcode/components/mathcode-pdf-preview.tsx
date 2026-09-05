"use client";

/**
 * 本页预览 / 下载编译后的 PDF。
 * 微信内嵌 iframe 打开 PDF 经常失败，所以用 pdf.js 画成图片页，方便长按保存。
 * 编译不另扣页：识别/转换时已经按页付过。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { compileMathcodePdf } from "@andyyyds/mathcode/lib/mathcode-pdf-client";

const AUTO_DEBOUNCE_MS = 900;
const PREVIEW_SCALE = 1.35;

type PagePreview = {
  page: number;
  dataUrl: string;
};

type Props = {
  tex: string;
  /** 最新一轮识别完成后自动编译；历史框需点「预览 PDF」 */
  auto: boolean;
  disabled?: boolean;
  watermarkFile?: File | null;
  watermarkFileName?: string;
  watermarkMissing?: boolean;
  downloadName?: string;
};

type PreviewStatus = "idle" | "compiling" | "rendering" | "ready" | "error";

async function renderPdfPages(blob: Blob): Promise<PagePreview[]> {
  const pdfjs = await import("pdfjs-dist");
  try {
    const workerUrl = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }

  const data = await blob.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: PagePreview[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: PREVIEW_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("当前浏览器不支持 canvas，无法预览 PDF");
    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;
    pages.push({
      page: i,
      dataUrl: canvas.toDataURL("image/png"),
    });
  }
  return pages;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function MathcodePdfPreview({
  tex,
  auto,
  disabled,
  watermarkFile,
  watermarkFileName,
  watermarkMissing,
  downloadName,
}: Props) {
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [error, setError] = useState("");
  const [pages, setPages] = useState<PagePreview[]>([]);
  const [compiledTex, setCompiledTex] = useState("");
  const [hasPdf, setHasPdf] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const blobUrlRef = useRef("");
  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const canCompile = Boolean(tex.trim()) && !disabled;
  const stale = Boolean(compiledTex && tex !== compiledTex);
  const fileName = downloadName?.trim() || "mathcode.pdf";

  const runCompile = useCallback(async () => {
    if (!tex.trim() || disabled) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const generation = ++genRef.current;
    setStatus("compiling");
    setError("");
    try {
      const blob = await compileMathcodePdf({
        tex,
        watermarkFile: watermarkFile ?? null,
        watermarkFileName,
        signal: controller.signal,
      });
      if (generation !== genRef.current) return;
      blobRef.current = blob;
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = URL.createObjectURL(blob);
      setHasPdf(true);
      setStatus("rendering");
      const rendered = await renderPdfPages(blob);
      if (generation !== genRef.current) return;
      setPages(rendered);
      setCompiledTex(tex);
      setStatus("ready");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      if (generation !== genRef.current) return;
      const message = caught instanceof Error ? caught.message : "编译失败";
      setError(message);
      setStatus("error");
    }
  }, [disabled, tex, watermarkFile, watermarkFileName]);

  useEffect(() => {
    if (!auto || !canCompile) return;
    const timer = window.setTimeout(() => {
      void runCompile();
    }, AUTO_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [auto, canCompile, runCompile]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const downloadPdf = useCallback(() => {
    if (!blobRef.current) return;
    downloadBlob(blobRef.current, fileName);
  }, [fileName]);

  const openPdf = useCallback(() => {
    if (!blobUrlRef.current) return;
    window.open(blobUrlRef.current, "_blank", "noopener,noreferrer");
  }, []);

  const busy = status === "compiling" || status === "rendering";

  return (
    <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white/70 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-[var(--ink)]">PDF 预览</h4>
          <p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">
            在本页直接看排版，也可下载 PDF。编译不另扣页。微信里可长按预览图保存。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary min-h-11 cursor-pointer px-3 text-sm"
            onClick={() => void runCompile()}
            disabled={!canCompile || busy}
          >
            {busy
              ? status === "rendering"
                ? "正在渲染…"
                : "正在编译…"
              : pages.length
                ? "重新编译"
                : "预览 PDF"}
          </button>
          <button
            type="button"
            className="btn btn-secondary min-h-11 cursor-pointer px-3 text-sm"
            onClick={downloadPdf}
            disabled={!hasPdf || busy}
          >
            下载 PDF
          </button>
          <button
            type="button"
            className="btn btn-secondary min-h-11 cursor-pointer px-3 text-sm"
            onClick={openPdf}
            disabled={!hasPdf || busy}
          >
            新窗口打开
          </button>
        </div>
      </div>

      {watermarkMissing ? (
        <p className="mt-2 text-xs text-amber-800">
          已开图片水印但还没选图，预览里可能缺图。选好图后再点「重新编译」。
        </p>
      ) : null}

      {stale && status === "ready" ? (
        <p className="mt-2 text-xs text-amber-800">
          源码已改，预览还是上一版。点「重新编译」更新 PDF。
        </p>
      ) : null}

      {status === "idle" && !pages.length ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          {auto
            ? "识别完成后会自动编译预览。"
            : "点「预览 PDF」在本页查看这一轮的排版。"}
        </p>
      ) : null}

      {busy ? (
        <p className="mt-3 text-sm text-[var(--muted)]" role="status">
          {status === "rendering"
            ? "PDF 已生成，正在画预览页…"
            : "正在把 LaTeX 编成 PDF，通常几秒到十几秒。"}
        </p>
      ) : null}

      {status === "error" && error ? (
        <p className="mt-3 whitespace-pre-wrap text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}

      {pages.length > 0 ? (
        <div className="mt-3 space-y-3">
          {pages.map((page) => (
            <figure
              key={page.page}
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-white"
            >
              <figcaption className="px-3 py-1.5 text-[11px] text-[var(--muted)]">
                第 {page.page} / {pages.length} 页
              </figcaption>
              {/* 用 img 而不是 canvas：微信可长按保存 */}
              <img
                src={page.dataUrl}
                alt={`PDF 第 ${page.page} 页预览`}
                className="block h-auto w-full"
              />
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}
