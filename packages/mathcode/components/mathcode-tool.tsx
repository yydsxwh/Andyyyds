"use client";

/**
 * MathCode 客户端上传工具（登录用户可用，按页计费）
 *
 * 输入：
 *   - 图片 / PDF：浏览器渲染后走 /api/mathcode/ocr
 *   - Markdown / txt / csv / html / tex：走 /api/mathcode/convert
 *   - Word / WPS / PPT / 表格 / OpenDocument：服务端拆成文字块和内嵌图，再分别 convert / ocr
 *   - 选择文件、拖拽、Ctrl+V / 长按粘贴（截图、PDF 等）都可以进同一条队列
 * 输出：每一轮上传在右侧新开一框，完整 XeLaTeX；本页可预览 / 下载 PDF，也可送进 Overleaf / VS Code。
 * 本轮微调提示词只附加到识别指令，不替换保真规则。
 * 题间留白按题型写进导出的 .tex，改开关不必重跑识别。
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
  filesFromClipboardItems,
  filesFromDataTransfer,
  normalizePastedFiles,
} from "@andyyyds/mathcode/lib/mathcode-clipboard";
import {
  MATHCODE_ACCEPT,
  classifyMathcodeFile,
  maxBytesForKind,
} from "@andyyyds/mathcode/lib/mathcode-filetypes";
import { MATHCODE_USER_HINT_MAX_CHARS } from "@andyyyds/mathcode/lib/mathcode-hint";
import {
  buildSpacingPrompt,
  DEFAULT_QUESTION_SPACING,
  normalizeQuestionSpacing,
  type MathcodeQuestionSpacing,
} from "@andyyyds/mathcode/lib/mathcode-spacing";
import { MathcodeSpacingPanel } from "@andyyyds/mathcode/components/mathcode-spacing-panel";
import { MathcodeBillingBar } from "@andyyyds/mathcode/components/mathcode-billing-bar";
import { MathcodePdfPreview } from "@andyyyds/mathcode/components/mathcode-pdf-preview";
import {
  MathcodePayDialog,
  type MathcodePayIntent,
} from "@andyyyds/mathcode/components/mathcode-pay-dialog";
import {
  clearMathcodePayResume,
  readMathcodePayResume,
} from "@andyyyds/mathcode/components/mathcode-wechat-pay";
import {
  checkMathcodePages,
  emptyMathcodeAccess,
  fetchMathcodeAccess,
  type MathcodeAccessState,
} from "@andyyyds/mathcode/lib/mathcode-access-client";

type ItemStatus = "pending" | "processing" | "done" | "error";

type Item = {
  id: string;
  label: string;
  source: "image" | "text";
  previewUrl: string;
  blob: Blob;
  mime: string;
  sourceText?: string;
  status: ItemStatus;
  latex?: string;
  error?: string;
};

type LatexOutput = {
  id: string;
  itemIds: string[];
  title: string;
  edited: string | null;
};

const ACCEPT = MATHCODE_ACCEPT;
const PDF_RENDER_SCALE = 2;
const WATERMARK_STORAGE_KEY = "yyds-mathcode-watermark-v1";
const HINT_STORAGE_KEY = "yyds-mathcode-prompt-hint-v1";
const SPACING_STORAGE_KEY = "yyds-mathcode-question-gap-v1";
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

const POSITION_IDS = new Set<WatermarkPosition>(WATERMARK_POSITIONS.map((p) => p.id));

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
      imageFileName: sanitizeWatermarkFileName(parsed.imageFileName || DEFAULT_WATERMARK.imageFileName),
    };
  } catch {
    return { ...DEFAULT_WATERMARK };
  }
}

function loadStoredSpacing(): MathcodeQuestionSpacing {
  if (typeof window === "undefined") return { ...DEFAULT_QUESTION_SPACING };
  try {
    const raw = localStorage.getItem(SPACING_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_QUESTION_SPACING };
    return normalizeQuestionSpacing(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_QUESTION_SPACING };
  }
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function fileFingerprint(file: File): string {
  return `${file.name}|${file.size}|${file.type}|${file.lastModified}`;
}

function joinItemBodies(items: Item[], ids: string[]): string {
  const idSet = new Set(ids);
  return items
    .filter((i) => idSet.has(i.id) && i.status === "done" && (i.latex || "").trim())
    .map((i) => `% ${i.label}\n${i.latex}`)
    .join("\n\n");
}

function batchTitle(round: number, batchItems: Item[]): string {
  const names = Array.from(new Set(batchItems.map((i) => i.label.replace(/\s·\s第\s.+$/, ""))));
  const shown = names.slice(0, 2).join("、");
  const extra = names.length > 2 ? ` 等${names.length}个文件` : "";
  return `第 ${round} 次识别 · ${shown}${extra}`;
}

function texForOutput(
  output: LatexOutput,
  items: Item[],
  wm: MathcodeWatermark,
  spacing: MathcodeQuestionSpacing,
): string {
  if (output.edited != null) return output.edited;
  const body = joinItemBodies(items, output.itemIds);
  return body.trim() ? wrapAsLatexDocument(body, wm, spacing) : "";
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {}
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "readonly");
  ta.setAttribute("aria-hidden", "true");
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

async function readFileAsPngIfNeeded(file: File): Promise<{ blob: Blob; mime: string; previewUrl: string }> {
  const mime = (file.type || "image/png").toLowerCase();
  const previewUrl = URL.createObjectURL(file);
  return { blob: file, mime, previewUrl };
}

async function renderPdfToItems(file: File): Promise<Item[]> {
  const pdfjs = await import("pdfjs-dist");
  try {
    const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
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
    await page.render({ canvasContext: ctx, viewport }).promise;
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

async function ocrOne(item: Item, userHint: string): Promise<string> {
  const form = new FormData();
  form.append("file", new File([item.blob], `${item.label}.png`, { type: item.mime }));
  if (userHint) form.append("userHint", userHint);
  const res = await fetch("/api/mathcode/ocr", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as { latex?: string; error?: string };
  if (!res.ok) throw new Error(data.error || `识别失败（HTTP ${res.status}）`);
  return (data.latex || "").trim();
}

async function convertOne(item: Item, userHint: string): Promise<string> {
  const text = (item.sourceText || "").trim();
  if (!text) return "";
  const res = await fetch("/api/mathcode/convert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, filename: item.label, userHint }),
  });
  const data = (await res.json().catch(() => ({}))) as { latex?: string; error?: string };
  if (!res.ok) throw new Error(data.error || `转换失败（HTTP ${res.status}）`);
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
  const res = await fetch("/api/mathcode/office", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    units?: { label: string; kind: "text" | "image"; text?: string; mime?: string; base64?: string }[];
  };
  if (!res.ok) throw new Error(data.error || `解析失败（HTTP ${res.status}）`);
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
  const [userHint, setUserHint] = useState("");
  const [hintHydrated, setHintHydrated] = useState(false);
  const [spacing, setSpacing] = useState<MathcodeQuestionSpacing>(DEFAULT_QUESTION_SPACING);
  const [spacingHydrated, setSpacingHydrated] = useState(false);
  const [access, setAccess] = useState<MathcodeAccessState>(emptyMathcodeAccess);
  const [accessLoading, setAccessLoading] = useState(true);
  const [payIntent, setPayIntent] = useState<MathcodePayIntent | null>(null);
  const [resumePayOrder, setResumePayOrder] = useState<{ orderId: string; amount: number } | null>(null);
  const payWaiterRef = useRef<{ resolve: (paid: boolean) => void } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const wmImageInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const pasteCatcherRef = useRef<HTMLDivElement>(null);
  const latestBoxRef = useRef<HTMLDivElement>(null);
  const processingRef = useRef(false);
  const queuedFilesRef = useRef<File[]>([]);
  const queuedFileKeysRef = useRef<Set<string>>(new Set());
  const runningItemIdsRef = useRef<Set<string>>(new Set());
  const userHintRef = useRef("");
  const spacingRef = useRef(spacing);
  const wmRef = useRef(wm);
  spacingRef.current = spacing;
  wmRef.current = wm;

  useEffect(() => {
    setWm(loadStoredWatermark());
    setWmHydrated(true);
    setSpacing(loadStoredSpacing());
    setSpacingHydrated(true);
    try {
      const stored = localStorage.getItem(HINT_STORAGE_KEY);
      if (stored) setUserHint(stored.slice(0, MATHCODE_USER_HINT_MAX_CHARS));
    } catch {}
    setHintHydrated(true);
    void fetchMathcodeAccess()
      .then((next) => {
        setAccess(next);
        setAccessLoading(false);
      })
      .catch(() => setAccessLoading(false));
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const payOrder = params.get("payOrder");
      const oauth = params.get("wechat_oauth");
      const stored = readMathcodePayResume();
      const resumeId = payOrder || stored?.orderId || "";
      if (resumeId) {
        void fetch(`/api/orders/${resumeId}`, { cache: "no-store", credentials: "same-origin" })
          .then(async (res) => {
            const data = (await res.json()) as { id?: string; status?: string; amount?: number };
            if (!res.ok || !data.id) return;
            if (data.status === "PAID") {
              clearMathcodePayResume();
              void fetchMathcodeAccess().then((next) => {
                setAccess(next);
                setAccessLoading(false);
              }).catch(() => undefined);
              return;
            }
            setResumePayOrder({ orderId: data.id, amount: Number(data.amount) || stored?.amount || 0 });
            setPayIntent({ kind: "membership" });
          })
          .catch(() => undefined);
      } else if (params.get("paid") === "1") {
        void fetchMathcodeAccess().then((next) => {
          setAccess(next);
          setAccessLoading(false);
        }).catch(() => undefined);
      }
      if (oauth === "error" || oauth === "denied") {
        setError(
          oauth === "denied"
            ? "未完成微信授权，无法直接支付。请再点微信支付。"
            : decodeURIComponent(params.get("msg") || "微信授权失败，请再试"),
        );
      }
      if (payOrder || params.get("paid") === "1" || oauth) {
        params.delete("payOrder");
        params.delete("paid");
        params.delete("wechat_oauth");
        params.delete("msg");
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
        window.history.replaceState(null, "", next);
      }
    }
  }, []);

  useEffect(() => {
    if (!wmHydrated) return;
    try { localStorage.setItem(WATERMARK_STORAGE_KEY, JSON.stringify(wm)); } catch {}
  }, [wm, wmHydrated]);

  useEffect(() => {
    userHintRef.current = userHint;
    if (!hintHydrated) return;
    try { localStorage.setItem(HINT_STORAGE_KEY, userHint); } catch {}
  }, [userHint, hintHydrated]);

  useEffect(() => {
    if (!spacingHydrated) return;
    try { localStorage.setItem(SPACING_STORAGE_KEY, JSON.stringify(spacing)); } catch {}
  }, [spacing, spacingHydrated]);

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
            ? { ...o, edited: wrapAsLatexDocument(extractLatexBody(o.edited), next, spacingRef.current) }
            : o,
        ),
      );
      return next;
    });
  }, []);

  const patchSpacing = useCallback((next: MathcodeQuestionSpacing) => {
    const normalized = normalizeQuestionSpacing(next);
    setSpacing(normalized);
    setOutputs((list) =>
      list.map((o) =>
        o.edited
          ? { ...o, edited: wrapAsLatexDocument(extractLatexBody(o.edited), wmRef.current, normalized) }
          : o,
      ),
    );
  }, []);

  const closePayDialog = useCallback((paid: boolean) => {
    const waiter = payWaiterRef.current;
    payWaiterRef.current = null;
    setPayIntent(null);
    setResumePayOrder(null);
    if (paid) clearMathcodePayResume();
    waiter?.resolve(paid);
  }, []);

  const requestPay = useCallback((intent: MathcodePayIntent) => {
    return new Promise<boolean>((resolve) => {
      payWaiterRef.current?.resolve(false);
      payWaiterRef.current = { resolve };
      setPayIntent(intent);
    });
  }, []);

  const refreshAccess = useCallback(async () => {
    try {
      const next = await fetchMathcodeAccess();
      setAccess(next);
      return next;
    } catch {
      return access;
    }
  }, [access]);

  const ensureQuota = useCallback(
    async (pageCount: number) => {
      if (access.unlimited) return true;
      const gate = await checkMathcodePages(pageCount);
      if (gate.ok) return true;
      if (gate.code === "NEED_LOGIN") {
        setError("请先登录后再转换");
        return false;
      }
      const paid = await requestPay(
        gate.code === "NEED_RENEW"
          ? { kind: "membership" }
          : { kind: "choose", pageCount: gate.pagesNeeded || pageCount },
      );
      if (!paid) {
        setError(gate.error);
        return false;
      }
      await refreshAccess();
      const again = await checkMathcodePages(pageCount);
      if (!again.ok) {
        setError(again.error);
        return false;
      }
      return true;
    },
    [access.unlimited, refreshAccess, requestPay],
  );

  const billableCount = useCallback((queue: Item[]) => {
    return queue.filter((it) => it.source !== "text" || Boolean((it.sourceText || "").trim())).length;
  }, []);

  const runQueue = useCallback(async (queue: Item[], hint: string) => {
    const uniqueQueue = queue.filter((it) => {
      if (runningItemIdsRef.current.has(it.id)) return false;
      runningItemIdsRef.current.add(it.id);
      return true;
    });
    if (uniqueQueue.length === 0) return;

    try {
      const needed = billableCount(uniqueQueue);
      if (needed > 0) {
        const allowed = await ensureQuota(needed);
        if (!allowed) {
          setItems((prev) =>
            prev.map((p) =>
              uniqueQueue.some((q) => q.id === p.id) && p.status === "pending"
                ? { ...p, status: "error", error: "未支付或额度不足" }
                : p,
            ),
          );
          return;
        }
      }

      for (const it of uniqueQueue) {
        setItems((prev) =>
          prev.map((p) => (p.id === it.id ? { ...p, status: "processing", error: undefined } : p)),
        );
        try {
          const runHint = [hint, buildSpacingPrompt(spacingRef.current)]
            .map((part) => part.trim())
            .filter(Boolean)
            .join("\n");
          const latex = it.source === "text" ? await convertOne(it, runHint) : await ocrOne(it, runHint);
          setItems((prev) =>
            prev.map((p) => (p.id === it.id ? { ...p, status: "done", latex } : p)),
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : "识别失败";
          setItems((prev) =>
            prev.map((p) => (p.id === it.id ? { ...p, status: "error", error: msg } : p)),
          );
          if (/额度|支付|会员|请先登录/.test(msg)) {
            setError(msg);
            break;
          }
        }
      }
      void refreshAccess();
    } finally {
      for (const it of uniqueQueue) runningItemIdsRef.current.delete(it.id);
    }
  }, [billableCount, ensureQuota, refreshAccess]);

  const acceptFiles = useCallback(
    async (files: FileList | File[]) => {
      const incoming = Array.from(files);
      if (incoming.length === 0) return;

      const accepted: File[] = [];
      for (const file of incoming) {
        const key = fileFingerprint(file);
        if (queuedFileKeysRef.current.has(key)) continue;
        queuedFileKeysRef.current.add(key);
        accepted.push(file);
      }
      if (accepted.length === 0) return;

      queuedFilesRef.current.push(...accepted);
      if (inputRef.current) inputRef.current.value = "";

      if (processingRef.current) {
        setStatus(`上一轮还在转换，已排队 ${queuedFilesRef.current.length} 个文件，完成后自动开始`);
        return;
      }

      processingRef.current = true;
      setProcessing(true);
      try {
        while (queuedFilesRef.current.length > 0) {
          const list = queuedFilesRef.current.splice(0);
          for (const file of list) queuedFileKeysRef.current.delete(fileFingerprint(file));
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
                setError(`PDF 解析失败（${f.name}）：${msg}。可先把关键页截图后再上传。`);
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
                setError((prev) => (prev ? `${prev}；` : "") + `${f.name}：${msg}`);
              }
            } else {
              setError((prev) =>
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
          await runQueue(newItems, userHintRef.current.trim());
          setStatus("本轮完成。可继续上传或粘贴，右侧会再开新框显示最新代码。");
        }
      } finally {
        processingRef.current = false;
        setProcessing(false);
      }
    },
    [runQueue],
  );

  // 其余 UI / 导出逻辑保持现有实现
  return null;
}
