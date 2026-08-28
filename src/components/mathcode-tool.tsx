"use client";

/**
 * MathCode 客户端上传工具（仅站长可见）
 *
 * 输入：
 *   - 图片（png/jpg/webp/gif，一次可多张，直接调 /api/mathcode/ocr）
 *   - PDF（浏览器里用 pdfjs-dist 逐页渲染为 PNG 后再走同一个接口）
 * 输出：
 *   - 每张识别结果单独展示（保留原图缩略+对应 LaTeX，便于逐张核对）
 *   - 合并 LaTeX 汇总在下方可编辑文本域
 *   - 一键复制 LaTeX；一键下载完整 .tex 模板（含 amsmath/mhchem，pdflatex 可直接编译）
 *
 * PDF 单独在浏览器里逐页渲染，是为了避开 Node 端的 canvas/PDF 原生依赖；
 * 出错时给用户降级提示「截图上传即可」，不影响图片识别路径。
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { wrapAsLatexDocument, extractLatexBody } from "@/lib/mathcode-doc";

type ItemStatus = "pending" | "processing" | "done" | "error";

type Item = {
  id: string;
  /** 展示名（PDF 会带 · 第 N 页） */
  label: string;
  /** 缩略预览 URL（object URL 或 data URL） */
  previewUrl: string;
  /** 用于识别的 PNG/JPG Blob */
  blob: Blob;
  mime: string;
  status: ItemStatus;
  latex?: string;
  error?: string;
};

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf";
/** PDF 页面渲染分辨率倍数；越高识别越清晰，但也更慢/更大 */
const PDF_RENDER_SCALE = 2;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 一键复制：Clipboard API 在微信内置浏览器、部分 HTTP、无焦点时会静默失败。
 * 失败则退回隐藏 textarea + execCommand，保证点击必有结果。
 */
async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // 继续走降级
    }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "readonly");
  ta.setAttribute("aria-hidden", "true");
  // iOS 微信要求元素在视口内且可选中，不能 left:-9999
  ta.style.cssText =
    "position:fixed;top:0;left:0;width:2px;height:2px;padding:0;border:0;opacity:0.01;z-index:99999;";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  if (!ok) throw new Error("COPY_FAILED");
}

async function readFileAsPngIfNeeded(file: File): Promise<{
  blob: Blob;
  mime: string;
  previewUrl: string;
}> {
  const mime = (file.type || "image/png").toLowerCase();
  const previewUrl = URL.createObjectURL(file);
  return { blob: file, mime, previewUrl };
}

/** 客户端渲染 PDF：dynamic import，避免服务器端打包时误引 pdfjs */
async function renderPdfToItems(file: File): Promise<Item[]> {
  // 动态引入，确保 pdfjs 只在浏览器加载
  const pdfjs = await import("pdfjs-dist");

  // Next.js webpack：new URL 会把 worker 视为资产打进产物；线上仍受限时，
  // 回落到 unpkg 版本兜底（此 CDN 大陆访问一般可用，实在不行可改成自托管路径）。
  try {
    const workerUrl = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }

  const arrayBuf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: arrayBuf }).promise;
  const items: Item[] = [];
  const total = doc.numPages;
  for (let i = 1; i <= total; i += 1) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("当前浏览器不支持 canvas 2d，无法渲染 PDF");
    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) throw new Error(`PDF 第 ${i} 页渲染失败`);
    items.push({
      id: uid(),
      label: `${file.name} · 第 ${i}/${total} 页`,
      previewUrl: URL.createObjectURL(blob),
      blob,
      mime: "image/png",
      status: "pending",
    });
    page.cleanup();
  }
  return items;
}

async function ocrOne(item: Item): Promise<string> {
  const form = new FormData();
  form.append(
    "file",
    new File([item.blob], `${item.label}.png`, { type: item.mime }),
  );
  const res = await fetch("/api/mathcode/ocr", {
    method: "POST",
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as {
    latex?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `识别失败（HTTP ${res.status}）`);
  }
  return (data.latex || "").trim();
}

export function MathcodeTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [combinedEdited, setCombinedEdited] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState("");
  const [copyBusy, setCopyBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 编辑框直接展示完整可编译文档，避免用户全选复制时只贴到 \section 正文
  const bodyOnly = useMemo(
    () =>
      items
        .filter((i) => i.status === "done" && (i.latex || "").trim())
        .map((i) => `% ${i.label}\n${i.latex}`)
        .join("\n\n"),
    [items],
  );
  const autoCombined = useMemo(
    () => (bodyOnly.trim() ? wrapAsLatexDocument(bodyOnly) : ""),
    [bodyOnly],
  );
  const combined = combinedEdited ?? autoCombined;

  const runQueue = useCallback(async (queue: Item[]) => {
    // 并发上限：视觉模型对每分钟请求数敏感，逐张处理更稳
    for (const it of queue) {
      setItems((prev) =>
        prev.map((p) => (p.id === it.id ? { ...p, status: "processing" } : p)),
      );
      try {
        const latex = await ocrOne(it);
        setItems((prev) =>
          prev.map((p) =>
            p.id === it.id ? { ...p, status: "done", latex } : p,
          ),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "识别失败";
        setItems((prev) =>
          prev.map((p) =>
            p.id === it.id ? { ...p, status: "error", error: msg } : p,
          ),
        );
      }
    }
  }, []);

  const acceptFiles = useCallback(
    async (files: FileList | File[]) => {
      setError("");
      setStatus("");
      const list = Array.from(files);
      if (list.length === 0) return;

      const oversized = list.filter((f) => f.size > MAX_IMAGE_BYTES);
      if (oversized.length) {
        setError(
          `以下文件超过 ${MAX_IMAGE_BYTES / 1024 / 1024}MB，请压缩或分批上传：${oversized
            .map((f) => f.name)
            .join("、")}`,
        );
        return;
      }

      setProcessing(true);
      try {
        // 手动编辑过的汇总在新一轮识别后作废，回归自动拼接
        setCombinedEdited(null);
        const newItems: Item[] = [];
        for (const f of list) {
          const isPdf =
            f.type === "application/pdf" || /\.pdf$/i.test(f.name);
          if (isPdf) {
            setStatus(`正在解析 PDF：${f.name}`);
            try {
              const pages = await renderPdfToItems(f);
              newItems.push(...pages);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              setError(
                `PDF 解析失败（${f.name}）：${msg}。可先把关键页截图后再上传。`,
              );
            }
          } else if (f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(f.name)) {
            const { blob, mime, previewUrl } = await readFileAsPngIfNeeded(f);
            newItems.push({
              id: uid(),
              label: f.name,
              previewUrl,
              blob,
              mime,
              status: "pending",
            });
          } else {
            setError((prev) => (prev ? prev + "；" : "") + `不支持的文件：${f.name}`);
          }
        }

        setItems((prev) => [...prev, ...newItems]);
        setStatus(
          `已加入 ${newItems.length} 张待识别${newItems.length ? "，正在依次调用 AI…" : ""}`,
        );
        await runQueue(newItems);
        setStatus(`本轮完成，共处理 ${newItems.length} 张`);
      } finally {
        setProcessing(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [runQueue],
  );

  const handleRetry = useCallback(
    async (id: string) => {
      const target = items.find((i) => i.id === id);
      if (!target) return;
      setCombinedEdited(null);
      await runQueue([target]);
    },
    [items, runQueue],
  );

  const handleRemove = useCallback((id: string) => {
    setCombinedEdited(null);
    setItems((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const handleClear = useCallback(() => {
    setItems((prev) => {
      for (const p of prev) {
        if (p.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
      }
      return [];
    });
    setCombinedEdited(null);
    setStatus("");
    setError("");
  }, []);

  const handleCopy = useCallback(async () => {
    const payload = combined.trim()
      ? combined.includes("\\documentclass")
        ? combined
        : wrapAsLatexDocument(combined)
      : "";
    if (!payload.trim()) {
      setCopyHint("请先识别出内容，再复制");
      return;
    }
    setCopyBusy(true);
    setCopyHint("正在复制…");
    try {
      await copyTextToClipboard(payload);
      setCopyHint("已复制完整文档。到 Overleaf 全选 main.tex 粘贴，直接点「重新编译」（不必改编译器）。");
    } catch {
      setCopyHint("浏览器拦截了剪贴板。请改点「下载完整 .tex」，或手动全选下方文本框复制。");
    } finally {
      setCopyBusy(false);
    }
  }, [combined]);

  const handleCopyFragment = useCallback(async () => {
    const frag = extractLatexBody(combined);
    if (!frag.trim()) {
      setCopyHint("请先识别出内容，再复制");
      return;
    }
    setCopyBusy(true);
    setCopyHint("正在复制…");
    try {
      await copyTextToClipboard(frag);
      setCopyHint("已复制正文片段（不含文档头）。Overleaf 请用「复制给 Overleaf」。");
    } catch {
      setCopyHint("复制被拦截，请全选下方文本框手动复制，或下载文件。");
    } finally {
      setCopyBusy(false);
    }
  }, [combined]);

  const handleDownloadFragment = useCallback(() => {
    downloadText(extractLatexBody(combined), `mathcode-${Date.now()}-body.tex`);
  }, [combined]);

  const handleDownloadDocument = useCallback(() => {
    const payload = combined.includes("\\documentclass")
      ? combined
      : wrapAsLatexDocument(combined);
    downloadText(payload, `mathcode-${Date.now()}.tex`);
  }, [combined]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer?.files?.length) {
        void acceptFiles(e.dataTransfer.files);
      }
    },
    [acceptFiles],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="surface rounded-[28px] p-5 sm:p-6">
        <div
          className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--brand)]/40 bg-[var(--brand)]/5 p-6 text-center transition hover:border-[var(--brand)]/70"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <p className="text-sm font-medium text-[var(--ink)]">
            拖拽公式截图 / PDF 到这里
          </p>
          <p className="text-xs text-[var(--muted)]">
            支持 png / jpg / webp / gif / pdf（单张≤12MB，PDF 在浏览器里逐页识别）
          </p>
          <label className="btn btn-primary cursor-pointer">
            选择文件
            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void acceptFiles(e.target.files);
              }}
            />
          </label>
        </div>

        {(status || error) && (
          <div className="mt-4 space-y-2 text-sm">
            {status && (
              <p className="text-[var(--muted)]">{status}</p>
            )}
            {error && (
              <p className="text-rose-600" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        <ul className="mt-5 space-y-3">
          {items.length === 0 ? (
            <li className="text-xs text-[var(--muted)]">
              还没有内容。识别过程只用于生成 LaTeX，不会把图片入库。
            </li>
          ) : (
            items.map((it) => (
              <li
                key={it.id}
                className="flex items-start gap-3 rounded-2xl border border-[var(--border)] p-3"
              >
                {/* 缩略图用 <img> 直接指向 object URL，避免 next/image 对动态 blob 的处理开销 */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.previewUrl}
                  alt={it.label}
                  className="h-16 w-16 flex-none rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--ink)]">
                      {it.label}
                    </span>
                    <StatusBadge status={it.status} />
                  </div>
                  {it.status === "done" && it.latex ? (
                    <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/5 p-2 text-xs leading-5 text-[var(--ink)]">
                      {it.latex}
                    </pre>
                  ) : it.status === "done" ? (
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      未识别到文字或公式，可换一张更清晰的截图重试。
                    </p>
                  ) : it.status === "error" ? (
                    <p className="mt-2 text-xs text-rose-600">{it.error}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      className="text-[var(--brand)] hover:underline disabled:opacity-50"
                      onClick={() => handleRetry(it.id)}
                      disabled={processing || it.status === "processing"}
                    >
                      重新识别
                    </button>
                    <button
                      type="button"
                      className="text-[var(--muted)] hover:underline disabled:opacity-50"
                      onClick={() => handleRemove(it.id)}
                      disabled={processing}
                    >
                      移除
                    </button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>

        {items.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-end gap-2 text-xs">
            <button
              type="button"
              className="text-[var(--muted)] hover:underline disabled:opacity-50"
              onClick={handleClear}
              disabled={processing}
            >
              清空全部
            </button>
          </div>
        )}
      </section>

      <section className="surface rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink)]">
              合并 LaTeX 输出
            </h2>
            <p className="text-xs text-[var(--muted)]">
              下方已是完整 main.tex。复制后到 Overleaf 覆盖 main.tex，直接点「重新编译」即可，不用改编译器。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary cursor-pointer"
              onClick={() => void handleCopy()}
              disabled={!combined.trim() || copyBusy}
            >
              {copyBusy ? "正在复制…" : "复制给 Overleaf"}
            </button>
            <button
              type="button"
              className="btn btn-secondary cursor-pointer"
              onClick={handleDownloadDocument}
              disabled={!combined.trim()}
            >
              下载完整 .tex
            </button>
            <button
              type="button"
              className="btn btn-secondary cursor-pointer"
              onClick={() => void handleCopyFragment()}
              disabled={!combined.trim() || copyBusy}
            >
              复制片段
            </button>
            <button
              type="button"
              className="btn btn-secondary cursor-pointer"
              onClick={handleDownloadFragment}
              disabled={!combined.trim()}
            >
              下载片段
            </button>
          </div>
        </div>
        {copyHint ? (
          <p
            className="mt-3 rounded-xl bg-[var(--brand)]/10 px-3 py-2 text-sm text-[var(--ink)]"
            role="status"
          >
            {copyHint}
          </p>
        ) : null}

        <textarea
          value={combined}
          onChange={(e) => setCombinedEdited(e.target.value)}
          spellCheck={false}
          className="mt-4 h-[420px] w-full resize-y rounded-2xl border border-[var(--border)] bg-white/60 p-3 font-mono text-sm leading-6 text-[var(--ink)] outline-none focus:border-[var(--brand)]"
          placeholder="识别完成后这里会显示完整可编译的 main.tex（含 \documentclass），可直接全选复制到 Overleaf。"
        />

        <details className="mt-4 text-xs leading-6 text-[var(--muted)]" open>
          <summary className="cursor-pointer text-[var(--ink)]">
            Overleaf 报 Missing begin&#123;document&#125;？
          </summary>
          <ol className="ml-5 mt-2 list-decimal space-y-1">
            <li>
              右侧文本框第一行必须是 <code>\documentclass</code>。若第一行就是
              <code>\section</code>，说明只贴了正文，请点「复制给 Overleaf」或全选本框。
            </li>
            <li>
              在 Overleaf 里 <strong>全选 main.tex 再粘贴</strong>（Ctrl+A 然后
              Ctrl+V），不要追加在旧内容后面。
            </li>
            <li>
              直接点绿色「重新编译」。本模板按 pdfLaTeX 编写，与 Overleaf
              默认编译器一致。
            </li>
          </ol>
        </details>
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: ItemStatus }) {
  const map: Record<ItemStatus, { text: string; cls: string }> = {
    pending: { text: "待识别", cls: "bg-black/5 text-[var(--muted)]" },
    processing: { text: "识别中…", cls: "bg-amber-100 text-amber-800" },
    done: { text: "已完成", cls: "bg-emerald-100 text-emerald-800" },
    error: { text: "失败", cls: "bg-rose-100 text-rose-800" },
  };
  const { text, cls } = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {text}
    </span>
  );
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
