export const ASSET_NAME_MAX = 200;
export const ASSET_DESC_MAX = 1000;
export const MEDIA_CATEGORY_NAME_MAX = 80;
export const PRODUCT_TITLE_MAX = 120;

export const ALLOWED_VIDEO_MIME = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/mpeg",
]);

export const MAX_UPLOAD_BYTES = 300 * 1024 * 1024; // 300MB

export function truncateLabel(name: string, max = 48) {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
