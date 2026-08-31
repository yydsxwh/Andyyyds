/**
 * MathCode 支持的上传种类。扩展名与体积限制集中在这里，
 * 方便以后加格式时只改一处（上传框 accept、体积校验、服务端白名单共用）。
 */

export const MATHCODE_MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MATHCODE_MAX_TEXT_BYTES = 2 * 1024 * 1024;
export const MATHCODE_MAX_OFFICE_BYTES = 32 * 1024 * 1024;
/** 一次拆出来的页/幻灯片/表过多会拖垮视觉接口，先截断并提示 */
export const MATHCODE_MAX_UNITS = 40;
/** 小于此体积的图多半是图标/装饰，不拿去 OCR */
export const MATHCODE_MIN_OCR_IMAGE_BYTES = 8 * 1024;

export type MathcodeFileKind = "image" | "pdf" | "text" | "office" | "unknown";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const PDF_EXT = new Set(["pdf"]);
const TEXT_EXT = new Set([
  "md",
  "markdown",
  "txt",
  "csv",
  "tsv",
  "html",
  "htm",
  "tex",
]);
/** Word / WPS / PPT / 表格 / OpenDocument：先当 zip/OOXML 或 Spreadsheet 解析 */
const OFFICE_EXT = new Set([
  "doc",
  "docx",
  "dotx",
  "wps",
  "wpt",
  "ppt",
  "pptx",
  "ppsx",
  "potx",
  "dps",
  "dpt",
  "xls",
  "xlsx",
  "xlsm",
  "xlsb",
  "et",
  "ett",
  "ods",
  "odt",
  "odp",
]);

export const MATHCODE_ACCEPT = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/markdown",
  "text/plain",
  "text/csv",
  "text/html",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-powerpoint",
  "application/vnd.ms-excel",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.oasis.opendocument.spreadsheet",
  ".doc,.docx,.wps,.wpt,.ppt,.pptx,.dps,.xls,.xlsx,.et,.ods,.odt,.odp,.md,.markdown,.txt,.csv,.html,.tex",
].join(",");

export function fileExtension(name: string): string {
  const base = name.replace(/^.*[/\\]/, "");
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function classifyMathcodeFile(name: string, mime = ""): MathcodeFileKind {
  const ext = fileExtension(name);
  const m = (mime || "").toLowerCase();
  if (IMAGE_EXT.has(ext) || m.startsWith("image/")) return "image";
  if (PDF_EXT.has(ext) || m === "application/pdf") return "pdf";
  if (TEXT_EXT.has(ext) || m.startsWith("text/")) return "text";
  if (OFFICE_EXT.has(ext)) return "office";
  if (m.includes("officedocument") || m.includes("msword") || m.includes("ms-excel") || m.includes("ms-powerpoint") || m.includes("opendocument") || m.includes("wps")) {
    return "office";
  }
  return "unknown";
}

export function maxBytesForKind(kind: MathcodeFileKind): number {
  if (kind === "text") return MATHCODE_MAX_TEXT_BYTES;
  if (kind === "office") return MATHCODE_MAX_OFFICE_BYTES;
  return MATHCODE_MAX_IMAGE_BYTES;
}
