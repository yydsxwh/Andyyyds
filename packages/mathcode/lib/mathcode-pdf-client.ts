/**
 * 浏览器侧请求本页 PDF 编译。不要 import mathcode-pdf.ts（含 Buffer / 环境变量）。
 */

export type MathcodePdfClientAttachment = {
  path: string;
  base64: string;
};

function sanitizeAttachPath(name: string): string {
  const cleaned = String(name || "")
    .replace(/^.*[\\/]/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "");
  return cleaned || "watermark.png";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("水印图片读取失败"));
    reader.readAsDataURL(blob);
  });
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string };
    if (json.error) return json.error;
  } catch {
    // 非 JSON 时用状态码
  }
  if (res.status === 401) return "请先登录后再预览 PDF";
  return `编译失败（${res.status}）`;
}

export async function compileMathcodePdf(input: {
  tex: string;
  watermarkFile?: File | null;
  watermarkFileName?: string;
  signal?: AbortSignal;
}): Promise<Blob> {
  const attachments: MathcodePdfClientAttachment[] = [];
  if (input.watermarkFile) {
    attachments.push({
      path: sanitizeAttachPath(
        input.watermarkFileName || input.watermarkFile.name,
      ),
      base64: await blobToBase64(input.watermarkFile),
    });
  }

  const res = await fetch("/api/mathcode/pdf", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tex: input.tex,
      attachments,
    }),
    signal: input.signal,
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  const blob = await res.blob();
  const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const magic = String.fromCharCode(...head);
  if (magic !== "%PDF-") {
    throw new Error("编译服务没有返回 PDF，请稍后重试");
  }
  return blob;
}
