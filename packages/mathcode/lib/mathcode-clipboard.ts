/**
 * 从剪贴板取出可走 MathCode 上传通道的文件。
 * 截图通常只在 DataTransfer.items 里；资源管理器复制的 PDF / Word 在 files 里。
 * 微信里 clipboard.read() 经常被拒，所以页面还要靠 paste 事件。
 */

import { classifyMathcodeFile } from "@andyyyds/mathcode/lib/mathcode-filetypes";

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/html": "html",
  "text/csv": "csv",
};

/** 纯文字/HTML 不当成「粘贴文件」；否则在提示词框里粘贴说明会被抢走 */
const IGNORE_CLIPBOARD_MIME = new Set([
  "text/plain",
  "text/html",
  "text/uri-list",
]);

function clipboardStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function extFromMime(mime: string): string {
  const m = (mime || "").toLowerCase();
  if (MIME_EXT[m]) return MIME_EXT[m];
  if (m.startsWith("image/")) return m.slice(6).split("+")[0] || "png";
  return "bin";
}

function fileKey(file: File): string {
  return `${file.name}|${file.size}|${file.type}|${file.lastModified}`;
}

function ensureFileName(file: File): File {
  const raw = (file.name || "").replace(/^.*[/\\]/, "").trim();
  if (raw && raw !== "image.png" && raw !== "blob") return file;
  const ext = extFromMime(file.type) || "png";
  // 系统截图常叫 image.png，多张连贴会撞名；用时间戳区分
  const named = raw && raw !== "blob" ? raw : `粘贴-${clipboardStamp()}.${ext}`;
  if (named === file.name) return file;
  return new File([file], named, {
    type: file.type || `image/${ext}`,
    lastModified: file.lastModified,
  });
}

function pushUnique(out: File[], seen: Set<string>, file: File | null) {
  if (!file || file.size <= 0) return;
  const named = ensureFileName(file);
  const key = fileKey(named);
  if (seen.has(key)) return;
  seen.add(key);
  out.push(named);
}

export function filesFromDataTransfer(
  dt: DataTransfer | null | undefined,
): File[] {
  if (!dt) return [];
  const out: File[] = [];
  const seen = new Set<string>();

  for (const file of Array.from(dt.files || [])) {
    pushUnique(out, seen, file);
  }

  const items = dt.items ? Array.from(dt.items) : [];
  for (const item of items) {
    if (item.kind !== "file") continue;
    const mime = (item.type || "").toLowerCase();
    if (IGNORE_CLIPBOARD_MIME.has(mime)) continue;
    pushUnique(out, seen, item.getAsFile());
  }

  return out;
}

export async function filesFromClipboardItems(
  items: ClipboardItem[],
): Promise<File[]> {
  const out: File[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    for (const type of item.types) {
      const mime = type.toLowerCase();
      if (IGNORE_CLIPBOARD_MIME.has(mime)) continue;
      if (
        !mime.startsWith("image/") &&
        mime !== "application/pdf" &&
        !mime.includes("officedocument") &&
        !mime.includes("msword") &&
        !mime.includes("ms-excel") &&
        !mime.includes("ms-powerpoint") &&
        !mime.includes("opendocument")
      ) {
        continue;
      }
      try {
        const blob = await item.getType(type);
        const ext = extFromMime(mime);
        const file = new File([blob], `粘贴-${clipboardStamp()}.${ext}`, {
          type: mime,
        });
        pushUnique(out, seen, file);
      } catch {
        // 某一 type 读失败不阻断其它条目
      }
    }
  }
  return out;
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const JPEG_MAGIC = [0xff, 0xd8];
const GIF_MAGIC = [0x47, 0x49, 0x46];
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46];

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((b, i) => bytes[i] === b);
}

/**
 * 资源管理器 / 微信偶发只给 application/octet-stream。
 * 用文件头补上 PDF / 图片类型，才能走进现有上传分类。
 */
export async function inferClipboardFileType(file: File): Promise<File> {
  if (classifyMathcodeFile(file.name, file.type) !== "unknown") return file;
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (startsWith(head, PDF_MAGIC)) {
    return new File([file], file.name || `粘贴-${clipboardStamp()}.pdf`, {
      type: "application/pdf",
      lastModified: file.lastModified,
    });
  }
  if (startsWith(head, PNG_MAGIC)) {
    return new File([file], file.name || `粘贴-${clipboardStamp()}.png`, {
      type: "image/png",
      lastModified: file.lastModified,
    });
  }
  if (startsWith(head, JPEG_MAGIC)) {
    return new File([file], file.name || `粘贴-${clipboardStamp()}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  }
  if (startsWith(head, GIF_MAGIC)) {
    return new File([file], file.name || `粘贴-${clipboardStamp()}.gif`, {
      type: "image/gif",
      lastModified: file.lastModified,
    });
  }
  if (
    startsWith(head, WEBP_RIFF) &&
    head.length >= 12 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return new File([file], file.name || `粘贴-${clipboardStamp()}.webp`, {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  }
  return file;
}

export async function normalizePastedFiles(files: File[]): Promise<File[]> {
  const out: File[] = [];
  for (const file of files) {
    out.push(await inferClipboardFileType(file));
  }
  return out;
}
