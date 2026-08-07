export const ASSET_NAME_MAX = 200;
export const ASSET_DESC_MAX = 1000;
export const MEDIA_CATEGORY_NAME_MAX = 80;
export const PRODUCT_TITLE_MAX = 120;

/** 媒体类型（自动识别），与用户自由「分类」MediaCategory 互不混淆 */
export const MEDIA_KINDS = [
  "VIDEO",
  "IMAGE",
  "AUDIO",
  "DOCUMENT",
  "OTHER",
] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_KIND_LABEL: Record<MediaKind, string> = {
  VIDEO: "视频",
  IMAGE: "图片",
  AUDIO: "音频",
  DOCUMENT: "文档",
  OTHER: "其他",
};

export const ALLOWED_VIDEO_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/mpeg",
]);

export const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/svg+xml",
]);

export const ALLOWED_AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/ogg",
]);

export const ALLOWED_DOCUMENT_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
]);

/** 上传白名单：空 MIME 时仍可靠扩展名放行 */
export const ALLOWED_UPLOAD_MIME = new Set([
  ...ALLOWED_VIDEO_MIME,
  ...ALLOWED_IMAGE_MIME,
  ...ALLOWED_AUDIO_MIME,
  ...ALLOWED_DOCUMENT_MIME,
]);

const EXT_TO_KIND: Record<string, MediaKind> = {
  mp4: "VIDEO",
  webm: "VIDEO",
  mov: "VIDEO",
  avi: "VIDEO",
  mpeg: "VIDEO",
  mpg: "VIDEO",
  m4v: "VIDEO",
  jpg: "IMAGE",
  jpeg: "IMAGE",
  png: "IMAGE",
  webp: "IMAGE",
  gif: "IMAGE",
  bmp: "IMAGE",
  svg: "IMAGE",
  mp3: "AUDIO",
  wav: "AUDIO",
  aac: "AUDIO",
  m4a: "AUDIO",
  ogg: "AUDIO",
  flac: "AUDIO",
  pdf: "DOCUMENT",
  doc: "DOCUMENT",
  docx: "DOCUMENT",
  xls: "DOCUMENT",
  xlsx: "DOCUMENT",
  ppt: "DOCUMENT",
  pptx: "DOCUMENT",
  txt: "DOCUMENT",
};

const EXT_TO_MIME: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  m4v: "video/mp4",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aac: "audio/aac",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
};

export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024; // 300MB

export const MEDIA_UPLOAD_ACCEPT = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/mpeg",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "audio/mpeg",
  "audio/wav",
  "audio/aac",
  "audio/mp4",
  "audio/x-m4a",
  ".mp4",
  ".webm",
  ".mov",
  ".avi",
  ".mpeg",
  ".mpg",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".mp3",
  ".wav",
  ".aac",
  ".m4a",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
].join(",");

export function isMediaKind(value: string): value is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(value);
}

export function fileExtension(fileName: string): string {
  const base = fileName.split(/[?#]/)[0] || "";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

/** 浏览器常给空或 octet-stream，用扩展名补全便于入库与分类 */
export function inferMimeType(mimeType: string, fileName: string): string {
  const mime = (mimeType || "").trim().toLowerCase();
  if (mime && mime !== "application/octet-stream") return mime;
  return EXT_TO_MIME[fileExtension(fileName)] || mime || "application/octet-stream";
}

/**
 * 按 MIME / 扩展名自动判定媒体类型。
 * 与用户自由分类（MediaCategory）无关，避免把「文件夹」和「文件形态」混在一起。
 */
export function classifyMediaKind(
  mimeType: string,
  fileName = "",
): MediaKind {
  const mime = (mimeType || "").trim().toLowerCase();
  if (mime.startsWith("video/") || ALLOWED_VIDEO_MIME.has(mime)) return "VIDEO";
  if (mime.startsWith("image/") || ALLOWED_IMAGE_MIME.has(mime)) return "IMAGE";
  if (mime.startsWith("audio/") || ALLOWED_AUDIO_MIME.has(mime)) return "AUDIO";
  if (ALLOWED_DOCUMENT_MIME.has(mime) || mime === "text/plain") return "DOCUMENT";

  const ext = fileExtension(fileName);
  if (ext && EXT_TO_KIND[ext]) return EXT_TO_KIND[ext];
  return "OTHER";
}

export function isAllowedUpload(mimeType: string, fileName: string): boolean {
  const mime = inferMimeType(mimeType, fileName);
  if (ALLOWED_UPLOAD_MIME.has(mime)) return true;
  // 扩展名已知即可入库（部分浏览器 MIME 不准）
  return Boolean(EXT_TO_KIND[fileExtension(fileName)]);
}

export function truncateLabel(name: string, max = 48) {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
