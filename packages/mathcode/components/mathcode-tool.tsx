"use client";

/**
 * MathCode 客户端上传工具（仅站长可见）
 *
 * 输入：
 *   - 图片 / PDF：浏览器渲染后走 /api/mathcode/ocr
 *   - Markdown / txt / csv / html / tex：走 /api/mathcode/convert
 *   - Word / WPS / PPT / 表格 / OpenDocument：服务端拆成文字块和内嵌图，再分别 convert / ocr
 * 输出：每一轮上传在右侧新开一框，完整 XeLaTeX，可送进 Overleaf / VS Code。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_WATERMARK,
  extractLatexBody,
  wrapAsLatexDocument,
  type MathcodeWatermark,
  type WatermarkPosition,
} from "@andyyyds/mathcode/lib/mathcode-doc";
import { openTexInOverleaf, openTexInVsCode } from "@andyyyds/mathcode/lib/mathcode-open";
import {
  MATHCODE_ACCEPT,
  classifyMathcodeFile,
  maxBytesForKind,
} from "@andyyyds/mathcode/lib/mathcode-filetypes";

type ItemStatus = "pending" | "processing" | "done" | "error";

type Item = {
  id: string;
  /** 展示名（PDF/PPT 会带 · 第 N 页） */
  label: string;
  source: "image" | "text";
  /** 缩略预览 URL；文本块可为空 */
  previewUrl: string;
  blob: Blob;
  mime: string;
  /** 文本转换用的原文 */
  sourceText?: string;
  status: ItemStatus;
  latex?: string;
  error?: string;
};

/** 每一轮上传单独一框，避免第二次识别还停在第一次的合并文本里 */
type LatexOutput = {
  id: string;
  itemIds: string[];
  title: string;
  edited: string | null;
};

const ACCEPT = MATHCODE_ACCEPT;
/** PDF 页面渲染分辨率倍数；越高识别越清晰，但也更慢/更大 */
const PDF_RENDER_SCALE = 2;
const WATERMARK_STORAGE_KEY = "yyds-mathcode-watermark-v1";
const WATERMARK_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

const WATERMARK_POSITIONS: { id: WatermarkPosition; label: string }[] = [
  { id: "tl", label: "左上角" },
  { id: "top", label: "上边" },
  { id: "tr", label: "右上角" },
  { id: "left", label: "左边" },
  { id: "center", label: "居中" },
  { id: "right", label: "右边" },
  { id: "bl", label: "左下角" },
  { id: "bottom", label: "下边" },
  { id: "br", label: "右下角" },
];

const POSITION_IDS = new Set<WatermarkPosition>(
  WATERMARK_POSITIONS.map((p) => p.id),
);

function sanitizeWatermarkFileName(name: string): string {
  const base = name.replace(/^.*[\\/]/, "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!base) return "watermark.png";
  return /\.(png|jpe?g|webp|gif)$/i.test(base) ? base : `${base}.png`;
}

function loadStoredWatermark(): MathcodeWatermark {
  if (typeof window === "undefined") return { ...DEFAULT_WATERMARK };
  try {
    const raw = localStorage.getItem(WATERMARK_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WATERMARK };
    const parsed = JSON.parse(raw) as Partial<MathcodeWatermark>;
    const position = POSITION_IDS.has(parsed.position as WatermarkPosition)
      ? (parsed.position as WatermarkPosition)
      : DEFAULT_WATERMARK.position;
    return {
      ...DEFAULT_WATERMARK,
      ...parsed,
      position,
      text: String(parsed.text ?? DEFAULT_WATERMARK.text).slice(0, 80),
      imageFileName: sanitizeWatermarkFileName(
        parsed.imageFileName || DEFAULT_WATERMARK.imageFileName,
      ),
    };
  } catch {
    return { ...DEFAULT_WATERMARK };
  }
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function joinItemBodies(items: Item[], ids: string[]): string {
  const idSet = new Set(ids);
  return items
    .filter((i) => idSet.has(i.id) && i.status === "done" && (i.latex || "").trim())
    .map((i) => `% ${i.label}\n${i.latex}`)
    .join("\n\n");
}

function batchTitle(round: number, batchItems: Item[]): string {
  const names = Array.from(
    new Set(batchItems.map((i) => i.label.replace(/\s·\s第\s.+$/, ""))),
  );
  const shown = names.slice(0, 2).join("、");
  const extra = names.length > 2 ? ` 等${names.length}个文件` : "";
  return `第 ${round} 次识别 · ${shown}${extra}`;
}

function texForOutput(
  output: LatexOutput,
  items: Item[],
  wm: MathcodeWatermark,
): string {
  if (output.edited != null) return output.edited;
  const body = joinItemBodies(items, output.itemIds);
  return body.trim() ? wrapAsLatexDocument(body, wm) : "";
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
      source: "image",
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

async function convertOne(item: Item): Promise<string> {
  const text = (item.sourceText || "").trim();
  if (!text) return "";
  const res = await fetch("/api/mathcode/convert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, filename: item.label }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    latex?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `转换失败（HTTP ${res.status}）`);
  }
  return (data.latex || "").trim();
}

function blobFromBase64(base64: string, mime: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function extractOfficeToItems(file: File): Promise<Item[]> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/mathcode/office", {
    method: "POST",
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    units?: {
      label: string;
      kind: "text" | "image";
      text?: string;
      mime?: string;
      base64?: string;
    }[];
  };
  if (!res.ok) {
    throw new Error(data.error || `解析失败（HTTP ${res.status}）`);
  }
  const units = data.units || [];
  return units.map((unit) => {
    if (unit.kind === "image" && unit.base64) {
      const mime = unit.mime || "image/png";
      const blob = blobFromBase64(unit.base64, mime);
      return {
        id: uid(),
        label: unit.label,
        source: "image" as const,
        previewUrl: URL.createObjectURL(blob),
        blob,
        mime,
        status: "pending" as const,
      };
    }
    const text = unit.text || "";
    return {
      id: uid(),
      label: unit.label,
      source: "text" as const,
      previewUrl: "",
      blob: new Blob([text], { type: "text/plain" }),
      mime: "text/plain",
      sourceText: text,
      status: "pending" as const,
    };
  });
}

export function MathcodeTool() {
  const [items, setItems] = useState<Item[]>([]);
  const [outputs, setOutputs] = useState<LatexOutput[]>([]);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [copyHint, setCopyHint] = useState("");
  const [copyBusy, setCopyBusy] = useState(false);
  const [wm, setWm] = useState<MathcodeWatermark>(DEFAULT_WATERMARK);
  const [wmHydrated, setWmHydrated] = useState(false);
  const [wmImageFile, setWmImageFile] = useState<File | null>(null);
  const [wmImagePreview, setWmImagePreview] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const wmImageInputRef = useRef<HTMLInputElement>(null);
  const latestBoxRef = useRef<HTMLDivElement>(null);
  const processingRef = useRef(false);
  const queuedFilesRef = useRef<File[]>([]);

  useEffect(() => {
    setWm(loadStoredWatermark());
    setWmHydrated(true);
  }, []);

  useEffect(() => {
    if (!wmHydrated) return;
    try {
      localStorage.setItem(WATERMARK_STORAGE_KEY, JSON.stringify(wm));
    } catch {
      // 隐私模式写不了 localStorage 时忽略，当场设置仍然生效
    }
  }, [wm, wmHydrated]);

  useEffect(() => {
    return () => {
      if (wmImagePreview.startsWith("blob:")) URL.revokeObjectURL(wmImagePreview);
    };
  }, [wmImagePreview]);

  useEffect(() => {
    if (outputs.length === 0) return;
    latestBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [outputs.length]);

  const patchWm = useCallback((patch: Partial<MathcodeWatermark>) => {
    setWm((prev) => {
      const next = { ...prev, ...patch };
      setOutputs((list) =>
        list.map((o) =>
          o.edited
            ? { ...o, edited: wrapAsLatexDocument(extractLatexBody(o.edited), next) }
            : o,
        ),
      );
      return next;
    });
  }, []);

  const runQueue = useCallback(async (queue: Item[]) => {
    // 并发上限：视觉模型对每分钟请求数敏感，逐张处理更稳
    for (const it of queue) {
      setItems((prev) =>
        prev.map((p) => (p.id === it.id ? { ...p, status: "processing" } : p)),
      );
      try {
        const latex =
          it.source === "text" ? await convertOne(it) : await ocrOne(it);
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
      const incoming = Array.from(files);
      if (incoming.length === 0) return;
      queuedFilesRef.current.push(...incoming);
      if (inputRef.current) inputRef.current.value = "";

      if (processingRef.current) {
        setStatus(
          `上一轮还在转换，已排队 ${queuedFilesRef.current.length} 个文件，完成后自动开始`,
        );
        return;
      }

      processingRef.current = true;
      setProcessing(true);
      try {
        while (queuedFilesRef.current.length > 0) {
          const list = queuedFilesRef.current.splice(0);
          setError("");
          const oversized = list.filter((f) => {
            const kind = classifyMathcodeFile(f.name, f.type);
            return f.size > maxBytesForKind(kind);
          });
          if (oversized.length) {
            setError(
              `以下文件过大，请压缩或分批上传：${oversized
                .map((f) => `${f.name}（${Math.ceil(f.size / 1024 / 1024)}MB）`)
                .join("、")}`,
            );
            continue;
          }

          const newItems: Item[] = [];
          for (const f of list) {
            const kind = classifyMathcodeFile(f.name, f.type);
            if (kind === "pdf") {
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
            } else if (kind === "image") {
              const { blob, mime, previewUrl } = await readFileAsPngIfNeeded(f);
              newItems.push({
                id: uid(),
                label: f.name,
                source: "image",
                previewUrl,
                blob,
                mime,
                status: "pending",
              });
            } else if (kind === "text") {
              setStatus(`正在读取：${f.name}`);
              const sourceText = await f.text();
              newItems.push({
                id: uid(),
                label: f.name,
                source: "text",
                previewUrl: "",
                blob: new Blob([sourceText], { type: "text/plain" }),
                mime: "text/plain",
                sourceText,
                status: "pending",
              });
            } else if (kind === "office") {
              setStatus(`正在解析文档：${f.name}`);
              try {
                const parts = await extractOfficeToItems(f);
                newItems.push(...parts);
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                setError(
                  (prev) =>
                    (prev ? `${prev}；` : "") +
                    `${f.name}：${msg}`,
                );
              }
            } else {
              setError(
                (prev) =>
                  (prev ? `${prev}；` : "") +
                  `不支持的文件：${f.name}。请改用图片、PDF、Word/WPS、PPT、表格或 Markdown。`,
              );
            }
          }

          if (newItems.length === 0) {
            setStatus("这一轮没有可识别的文件");
            continue;
          }

          setItems((prev) => [...prev, ...newItems]);
          setOutputs((prev) => [
            ...prev,
            {
              id: uid(),
              itemIds: newItems.map((i) => i.id),
              title: batchTitle(prev.length + 1, newItems),
              edited: null,
            },
          ]);
          setStatus("已加入队列，正在转换…右侧会新开一框");
          await runQueue(newItems);
          setStatus("本轮完成。可继续上传，右侧会再开新框显示最新代码。");
        }
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },
    [runQueue],
  );

  const handleRetry = useCallback(
    async (id: string) => {
      const target = items.find((i) => i.id === id);
      if (!target) return;
      setOutputs((prev) =>
        prev.map((o) =>
          o.itemIds.includes(id) ? { ...o, edited: null } : o,
        ),
      );
      await runQueue([target]);
    },
    [items, runQueue],
  );

  const handleRemove = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
    setOutputs((prev) =>
      prev
        .map((o) => ({ ...o, itemIds: o.itemIds.filter((x) => x !== id) }))
        .filter((o) => o.itemIds.length > 0),
    );
  }, []);

  const handleClear = useCallback(() => {
    setItems((prev) => {
      for (const p of prev) {
        if (p.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
      }
      return [];
    });
    setOutputs([]);
    setStatus("");
    setError("");
  }, []);

  const copyOutput = useCallback(
    async (output: LatexOutput, fragment: boolean) => {
      const full = texForOutput(output, items, wm);
      const payload = fragment ? extractLatexBody(full) : full;
      if (!payload.trim()) {
        setCopyHint("请先等这一轮识别完成，再复制");
        return;
      }
      setCopyBusy(true);
      setCopyHint("正在复制…");
      try {
        await copyTextToClipboard(payload);
        const imageNote =
          !fragment && wm.imageEnabled
            ? ` 图片水印请把 ${wm.imageFileName} 传到 Overleaf 与 main.tex 同级。`
            : "";
        setCopyHint(
          fragment
            ? `已复制「${output.title}」正文片段。`
            : `已复制「${output.title}」完整 XeLaTeX。Overleaf：Menu → Compiler 选 XeLaTeX。${imageNote}`,
        );
      } catch {
        setCopyHint("浏览器拦截了剪贴板。请改点下载，或手动全选这一框复制。");
      } finally {
        setCopyBusy(false);
      }
    },
    [items, wm],
  );

  const downloadOutput = useCallback(
    (output: LatexOutput, fragment: boolean) => {
      const full = texForOutput(output, items, wm);
      const payload = fragment ? extractLatexBody(full) : full;
      if (!payload.trim()) return;
      const stamp = Date.now();
      downloadText(
        payload,
        fragment ? `mathcode-${stamp}-body.tex` : `mathcode-${stamp}.tex`,
      );
      if (!fragment && wm.imageEnabled && wmImageFile) {
        downloadBlob(wmImageFile, wm.imageFileName);
        setCopyHint(
          `已下载 .tex 和 ${wm.imageFileName}。Overleaf 请把两份文件放在同一项目根目录。`,
        );
      }
    },
    [items, wm, wmImageFile],
  );

  const openOutputOverleaf = useCallback(
    (output: LatexOutput) => {
      const tex = texForOutput(output, items, wm);
      if (!tex.trim()) {
        setCopyHint("请先等这一轮识别完成，再打开 Overleaf");
        return;
      }
      openTexInOverleaf(tex, "main.tex");
      setCopyHint(
        wm.imageEnabled
          ? `已在新标签打开 Overleaf（XeLaTeX）。若用了图片水印，请把 ${wm.imageFileName} 传到项目根目录。`
          : "已在新标签打开 Overleaf，编译器已选 XeLaTeX。",
      );
    },
    [items, wm],
  );

  const openOutputVsCode = useCallback(
    async (output: LatexOutput) => {
      const tex = texForOutput(output, items, wm);
      if (!tex.trim()) {
        setCopyHint("请先等这一轮识别完成，再打开 VS Code");
        return;
      }
      const result = await openTexInVsCode(tex, "main.tex");
      if (result === "cancelled") return;
      if (result === "desktop") {
        setCopyHint("已下载 main.tex，并优先打开 VS Code 客户端。请在客户端里打开刚下载的文件。");
        return;
      }
      setCopyHint(
        "未检测到 VS Code 客户端，已下载 main.tex 并打开网页版。安装客户端后可再点一次本按钮。",
      );
    },
    [items, wm],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.dataTransfer?.files?.length) {
        void acceptFiles(e.dataTransfer.files);
      }
    },
    [acceptFiles],
  );

  const handleWmImagePicked = useCallback(
    (file: File | null) => {
      setWmImagePreview((prev) => {
        if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return file ? URL.createObjectURL(file) : "";
      });
      setWmImageFile(file);
      if (file) {
        patchWm({
          imageEnabled: true,
          imageFileName: sanitizeWatermarkFileName(file.name) || "watermark.png",
        });
      }
    },
    [patchWm],
  );

  const handleDownloadWatermarkImage = useCallback(() => {
    if (!wmImageFile) {
      setCopyHint("请先选择一张水印图片");
      return;
    }
    downloadBlob(wmImageFile, wm.imageFileName);
    setCopyHint(`已下载 ${wm.imageFileName}，请传到 Overleaf 与 main.tex 同级。`);
  }, [wmImageFile, wm.imageFileName]);

  const tiled = wm.rows * wm.cols > 1;
  const latestOutputId = outputs[outputs.length - 1]?.id;
  const outputCards = [...outputs].reverse();

  return (
    <div className="grid gap-6">
      <section className="surface rounded-[28px] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink)]">
              LaTeX 水印（写入导出源码）
            </h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              文字和图片水印都会写进 .tex 的每一页背景层，不占正文、不压公式。
              复制/下载时按当前设置重新生成。排版可改倾斜或水平、居中或边角、一行或铺满多行。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`btn min-h-11 px-4 ${wm.textEnabled ? "btn-primary" : "btn-secondary"}`}
              onClick={() => patchWm({ textEnabled: !wm.textEnabled })}
            >
              {wm.textEnabled ? "关闭文字水印" : "开启文字水印"}
            </button>
            <button
              type="button"
              className={`btn min-h-11 px-4 ${wm.imageEnabled ? "btn-primary" : "btn-secondary"}`}
              onClick={() => patchWm({ imageEnabled: !wm.imageEnabled })}
            >
              {wm.imageEnabled ? "关闭图片水印" : "开启图片水印"}
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--muted)]">水印文字</span>
            <input
              className="field min-h-11 w-full rounded-xl px-3"
              value={wm.text}
              maxLength={80}
              onChange={(e) => patchWm({ text: e.target.value, textEnabled: true })}
              placeholder="例如：内部资料 禁止外传"
            />
          </label>
          <div className="text-sm">
            <span className="mb-1 block text-xs text-[var(--muted)]">水印图片</span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary min-h-11 px-4"
                onClick={() => wmImageInputRef.current?.click()}
              >
                选择图片
              </button>
              <button
                type="button"
                className="btn btn-secondary min-h-11 px-4"
                onClick={handleDownloadWatermarkImage}
                disabled={!wmImageFile}
              >
                下载水印图片
              </button>
              <input
                ref={wmImageInputRef}
                type="file"
                accept={WATERMARK_IMAGE_ACCEPT}
                className="hidden"
                onChange={(e) => handleWmImagePicked(e.target.files?.[0] ?? null)}
              />
              {wmImagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={wmImagePreview}
                  alt="水印预览"
                  className="h-11 w-11 rounded-lg border border-[var(--border)] object-contain"
                />
              ) : (
                <span className="text-xs text-[var(--muted)]">
                  Overleaf 文件名 {wm.imageFileName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <fieldset>
            <legend className="mb-1 text-xs text-[var(--muted)]">方向</legend>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`btn min-h-11 px-3 text-sm ${wm.angle === 0 ? "btn-primary" : "btn-secondary"}`}
                onClick={() => patchWm({ angle: 0 })}
              >
                水平
              </button>
              <button
                type="button"
                className={`btn min-h-11 px-3 text-sm ${wm.angle === 30 ? "btn-primary" : "btn-secondary"}`}
                onClick={() => patchWm({ angle: 30 })}
              >
                倾斜 30°
              </button>
              <button
                type="button"
                className={`btn min-h-11 px-3 text-sm ${wm.angle === -30 ? "btn-primary" : "btn-secondary"}`}
                onClick={() => patchWm({ angle: -30 })}
              >
                倾斜 -30°
              </button>
            </div>
            <label className="mt-2 flex min-h-11 items-center gap-2 text-xs text-[var(--muted)]">
              自定义角度
              <input
                type="number"
                min={-90}
                max={90}
                className="field min-h-11 w-24 rounded-xl px-2 text-sm text-[var(--ink)]"
                value={wm.angle}
                onChange={(e) => patchWm({ angle: Number(e.target.value) || 0 })}
              />
            </label>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-xs text-[var(--muted)]">
              行 × 列（1×1 为单枚，大于 1 则铺满）
            </legend>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`btn min-h-11 px-3 text-sm ${!tiled ? "btn-primary" : "btn-secondary"}`}
                onClick={() => patchWm({ rows: 1, cols: 1 })}
              >
                一行
              </button>
              <button
                type="button"
                className={`btn min-h-11 px-3 text-sm ${wm.rows === 3 && wm.cols === 2 ? "btn-primary" : "btn-secondary"}`}
                onClick={() => patchWm({ rows: 3, cols: 2 })}
              >
                3 行 2 列
              </button>
              <button
                type="button"
                className={`btn min-h-11 px-3 text-sm ${wm.rows === 4 && wm.cols === 3 ? "btn-primary" : "btn-secondary"}`}
                onClick={() => patchWm({ rows: 4, cols: 3 })}
              >
                4 行 3 列
              </button>
            </div>
            <div className="mt-2 flex gap-2">
              <label className="flex min-h-11 flex-1 items-center gap-2 text-xs text-[var(--muted)]">
                行
                <input
                  type="number"
                  min={1}
                  max={8}
                  className="field min-h-11 w-full rounded-xl px-2 text-sm text-[var(--ink)]"
                  value={wm.rows}
                  onChange={(e) =>
                    patchWm({ rows: Math.min(8, Math.max(1, Number(e.target.value) || 1)) })
                  }
                />
              </label>
              <label className="flex min-h-11 flex-1 items-center gap-2 text-xs text-[var(--muted)]">
                列
                <input
                  type="number"
                  min={1}
                  max={8}
                  className="field min-h-11 w-full rounded-xl px-2 text-sm text-[var(--ink)]"
                  value={wm.cols}
                  onChange={(e) =>
                    patchWm({ cols: Math.min(8, Math.max(1, Number(e.target.value) || 1)) })
                  }
                />
              </label>
            </div>
          </fieldset>

          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--muted)]">透明度（8–40%）</span>
            <input
              type="range"
              min={8}
              max={40}
              className="mt-3 w-full"
              value={wm.opacityPercent}
              onChange={(e) => patchWm({ opacityPercent: Number(e.target.value) })}
            />
            <span className="text-xs text-[var(--muted)]">{wm.opacityPercent}%</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-[var(--muted)]">文字字号</span>
              <select
                className="field min-h-11 w-full rounded-xl px-2 text-sm"
                value={wm.zihao}
                onChange={(e) => patchWm({ zihao: e.target.value })}
              >
                <option value="1">一号</option>
                <option value="2">二号</option>
                <option value="-2">小二</option>
                <option value="3">三号</option>
                <option value="4">四号</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-[var(--muted)]">图片宽(cm)</span>
              <input
                type="number"
                min={0.8}
                max={12}
                step={0.2}
                className="field min-h-11 w-full rounded-xl px-2 text-sm"
                value={wm.imageWidthCm}
                onChange={(e) =>
                  patchWm({
                    imageWidthCm: Math.min(12, Math.max(0.8, Number(e.target.value) || 3.2)),
                  })
                }
              />
            </label>
          </div>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-2 text-xs text-[var(--muted)]">
            {tiled
              ? "当前是多行铺满，位置格子仅在「一行 / 1×1」时生效"
              : "位置（居中 / 边上 / 角上）"}
          </legend>
          <div className="grid max-w-md grid-cols-3 gap-2">
            {WATERMARK_POSITIONS.map((pos) => (
              <button
                key={pos.id}
                type="button"
                disabled={tiled}
                className={`btn min-h-11 px-2 text-sm touch-manipulation ${
                  wm.position === pos.id && !tiled ? "btn-primary" : "btn-secondary"
                } disabled:opacity-40`}
                onClick={() => patchWm({ position: pos.id, rows: 1, cols: 1 })}
              >
                {pos.label}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="surface rounded-[28px] p-5 sm:p-6">
        <div
          className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--brand)]/40 bg-[var(--brand)]/5 p-6 text-center transition hover:border-[var(--brand)]/70"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <p className="text-sm font-medium text-[var(--ink)]">
            拖拽截图、PDF、Word / WPS、PPT、表格或 Markdown 到这里
          </p>
          <p className="text-xs text-[var(--muted)]">
            图片 / PDF 按页识别；Word、WPS、PPT、Excel、Markdown 抽正文再转 LaTeX。
            旧版 .doc / .ppt / .xls 请先另存为 docx / pptx / xlsx，或导出 PDF。
            每上传一轮，右侧都会新开一框。
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
              还没有内容。转换过程只用于生成 LaTeX，不会把文件入库。
            </li>
          ) : (
            items.map((it) => (
              <li
                key={it.id}
                className="flex items-start gap-3 rounded-2xl border border-[var(--border)] p-3"
              >
                {it.source === "image" && it.previewUrl ? (
                  // 缩略图用 <img> 直接指向 object URL，避免 next/image 对动态 blob 的处理开销
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.previewUrl}
                    alt={it.label}
                    className="h-16 w-16 flex-none rounded-lg object-cover"
                  />
                ) : (
                  <div
                    className="flex h-16 w-16 flex-none items-center justify-center rounded-lg bg-[var(--brand)]/10 text-[10px] font-medium text-[var(--brand)]"
                    aria-hidden="true"
                  >
                    文本
                  </div>
                )}
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
                      未识别到内容，可换更清晰的截图或另存为 PDF 再试。
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
                      重试
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink)]">
              LaTeX 输出
            </h2>
            <p className="text-xs text-[var(--muted)]">
              每上传一次都会在这里新开一框，最新一次在最上面。可用 Overleaf / VS Code 直接打开当前源码。
            </p>
          </div>
          {outputs.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary min-h-11 px-4 text-sm"
                disabled={!texForOutput(outputs[outputs.length - 1], items, wm).trim()}
                onClick={() => openOutputOverleaf(outputs[outputs.length - 1])}
              >
                打开 Overleaf
              </button>
              <button
                type="button"
                className="btn btn-secondary min-h-11 px-4 text-sm"
                disabled={!texForOutput(outputs[outputs.length - 1], items, wm).trim()}
                onClick={() => void openOutputVsCode(outputs[outputs.length - 1])}
              >
                打开 VS Code
              </button>
            </div>
          ) : null}
        </div>
        {copyHint ? (
          <p
            className="mt-3 rounded-xl bg-[var(--brand)]/10 px-3 py-2 text-sm text-[var(--ink)]"
            role="status"
          >
            {copyHint}
          </p>
        ) : null}

        {outputCards.length === 0 ? (
          <p className="mt-4 text-xs text-[var(--muted)]">
            识别完成后，完整可编译的 main.tex 会出现在这里。可继续上传，每次都会新增一框。
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {outputCards.map((output) => {
              const tex = texForOutput(output, items, wm);
              const busy = output.itemIds.some((id) => {
                const it = items.find((i) => i.id === id);
                return it?.status === "pending" || it?.status === "processing";
              });
              const isLatest = output.id === latestOutputId;
              return (
                <div
                  key={output.id}
                  ref={isLatest ? latestBoxRef : undefined}
                  className={`rounded-2xl border p-3 sm:p-4 ${
                    isLatest
                      ? "border-[var(--brand)] bg-[var(--brand)]/5"
                      : "border-[var(--border)] bg-white/40"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--ink)]">
                        {output.title}
                        {isLatest ? (
                          <span className="ml-2 rounded-full bg-[var(--brand)]/15 px-2 py-0.5 text-[10px] font-medium text-[var(--brand)]">
                            最新
                          </span>
                        ) : null}
                      </h3>
                      {busy ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          正在识别，源码会写进这一框…
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-primary min-h-11 cursor-pointer px-3 text-sm"
                        onClick={() => openOutputOverleaf(output)}
                        disabled={!tex.trim()}
                      >
                        打开 Overleaf
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary min-h-11 cursor-pointer px-3 text-sm"
                        onClick={() => void openOutputVsCode(output)}
                        disabled={!tex.trim()}
                      >
                        打开 VS Code
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary min-h-11 cursor-pointer px-3 text-sm"
                        onClick={() => void copyOutput(output, false)}
                        disabled={!tex.trim() || copyBusy}
                      >
                        {copyBusy ? "正在复制…" : "复制源码"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary min-h-11 cursor-pointer px-3 text-sm"
                        onClick={() => downloadOutput(output, false)}
                        disabled={!tex.trim()}
                      >
                        下载完整 .tex
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary min-h-11 cursor-pointer px-3 text-sm"
                        onClick={() => void copyOutput(output, true)}
                        disabled={!tex.trim() || copyBusy}
                      >
                        复制片段
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary min-h-11 cursor-pointer px-3 text-sm"
                        onClick={() => downloadOutput(output, true)}
                        disabled={!tex.trim()}
                      >
                        下载片段
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={tex}
                    onChange={(e) =>
                      setOutputs((prev) =>
                        prev.map((o) =>
                          o.id === output.id ? { ...o, edited: e.target.value } : o,
                        ),
                      )
                    }
                    spellCheck={false}
                    className="mt-3 h-[280px] w-full resize-y rounded-2xl border border-[var(--border)] bg-white/80 p-3 font-mono text-sm leading-6 text-[var(--ink)] outline-none focus:border-[var(--brand)] sm:h-[360px]"
                    placeholder={
                      busy
                        ? "识别中…"
                        : "这一轮的完整 main.tex 会显示在这里。"
                    }
                  />
                </div>
              );
            })}
          </div>
        )}

        <details className="mt-4 text-xs leading-6 text-[var(--muted)]">
          <summary className="cursor-pointer text-[var(--ink)]">
            Overleaf 编译步骤（本次必须 XeLaTeX）
          </summary>
          <ol className="ml-5 mt-2 list-decimal space-y-1">
            <li>
              点「打开 Overleaf」会把当前 .tex 送进新工程（Compiler = XeLaTeX）。
              「打开 VS Code」会先唤起电脑上的 VS Code 客户端；没有客户端再打开网页版。同时会下载 main.tex。
            </li>
            <li>
              也可「复制源码」后，在 Overleaf 里全选 main.tex 粘贴（Ctrl+A → Ctrl+V）。
            </li>
            <li>
              左上角 <strong>Menu → Compiler → XeLaTeX</strong>（不要用默认
              pdfLaTeX，否则中文 ctexart 会失败）。
            </li>
            <li>
              若开启了图片水印，把下载的图片传到项目根目录，文件名与源码里
              <code> \includegraphics </code> 的名字一致（默认 watermark.png）。
            </li>
            <li>点绿色「重新编译」。</li>
          </ol>
        </details>
      </section>
      </div>
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
  downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), filename);
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
