/**
 * 把 MathCode 生成的 XeLaTeX 编成 PDF，供本页预览 / 下载。
 *
 * 生产机没有 TeX Live（装全量太大），默认走 XeLaTeX HTTP 编译。
 * 源码只用于这一次出 PDF，不落库。改编译地址用 MATHCODE_LATEX_COMPILE_URL。
 * 预览/下载不另扣页：识别成功时已经按页计费。
 */

export const MATHCODE_PDF_MAX_TEX_CHARS = 400_000;
export const MATHCODE_PDF_MAX_ATTACH_BYTES = 2 * 1024 * 1024;
export const MATHCODE_PDF_COMPILE_TIMEOUT_MS = 90_000;

const DEFAULT_COMPILE_URL = "https://latex.ytotech.com/builds/sync";

export type MathcodePdfAttachment = {
  path: string;
  bytes: Buffer;
};

export type MathcodePdfOk = { ok: true; pdf: Buffer };
export type MathcodePdfFail = { ok: false; error: string };

function compileUrl(): string {
  const raw = String(process.env.MATHCODE_LATEX_COMPILE_URL || "").trim();
  return raw || DEFAULT_COMPILE_URL;
}

/** 从 XeLaTeX 日志里抽出真正的报错行，方便前台展示。 */
export function summarizeLatexLog(log: string): string {
  const lines = String(log || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const hits = lines.filter(
    (line) =>
      line.startsWith("!") ||
      /Fatal error|Emergency stop|Undefined control sequence|Package .* Error/i.test(
        line,
      ),
  );
  if (hits.length === 0) return "";
  return hits.slice(0, 6).join("\n");
}

function looksLikePdf(buf: Buffer): boolean {
  return buf.length > 8 && buf.subarray(0, 5).toString("utf8") === "%PDF-";
}

export async function compileLatexToPdf(input: {
  tex: string;
  attachments?: MathcodePdfAttachment[];
}): Promise<MathcodePdfOk | MathcodePdfFail> {
  const tex = String(input.tex || "").trim();
  if (!tex) return { ok: false, error: "没有可编译的 LaTeX" };
  if (tex.length > MATHCODE_PDF_MAX_TEX_CHARS) {
    return { ok: false, error: "源码过长，请拆成更小的文档再预览" };
  }

  const resources: Array<Record<string, unknown>> = [
    { main: true, path: "main.tex", content: tex },
  ];
  for (const file of input.attachments || []) {
    const name = file.path.replace(/^.*[\\/]/, "").replace(/[^a-zA-Z0-9._-]/g, "");
    if (!name || !file.bytes?.length) continue;
    if (file.bytes.length > MATHCODE_PDF_MAX_ATTACH_BYTES) {
      return { ok: false, error: `附件 ${name} 超过 2MB` };
    }
    resources.push({
      path: name,
      file: file.bytes.toString("base64"),
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    MATHCODE_PDF_COMPILE_TIMEOUT_MS,
  );
  try {
    const res = await fetch(compileUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compiler: "xelatex", resources }),
      signal: controller.signal,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    if (res.ok && looksLikePdf(buf)) {
      return { ok: true, pdf: buf };
    }

    let message = `编译失败（HTTP ${res.status}）`;
    if (!looksLikePdf(buf)) {
      try {
        const json = JSON.parse(buf.toString("utf8")) as {
          error?: string;
          log_files?: Record<string, string>;
        };
        const log = Object.values(json.log_files || {}).join("\n");
        const summary = summarizeLatexLog(log);
        if (summary) message = summary;
        else if (json.error) message = json.error;
      } catch {
        // 非 JSON 时沿用 HTTP 状态
      }
    }
    return { ok: false, error: message };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "编译超时，请缩短文档后再试" };
    }
    const message = error instanceof Error ? error.message : "编译失败";
    return { ok: false, error: `无法连接编译服务：${message}` };
  } finally {
    clearTimeout(timer);
  }
}
