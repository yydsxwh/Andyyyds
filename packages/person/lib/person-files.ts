/**
 * 个人展示附件：栏目都可以挂文件。规则集中在这里，方便以后整包拆站。
 * 程序/压缩包只提供下载，不在浏览器里执行。
 */

export const PERSON_MAX_FILES = 20;
export const PERSON_MAX_FILE_BYTES = 200 * 1024 * 1024;
export const PERSON_MAX_FILE_LABEL = "200MB";
export const PERSON_TEXT_PREVIEW_MAX = 512 * 1024;
export const PERSON_FILE_NAME_MAX = 180;

export const PERSON_FILE_KINDS = [
  "image",
  "video",
  "audio",
  "pdf",
  "text",
  "code",
  "markdown",
  "latex",
  "table",
  "office",
  "animation",
  "archive",
  "program",
  "other",
] as const;

export type PersonFileKind = (typeof PERSON_FILE_KINDS)[number];

export const PERSON_FILE_KIND_LABEL: Record<PersonFileKind, string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
  pdf: "PDF",
  text: "文本",
  code: "代码",
  markdown: "Markdown",
  latex: "LaTeX",
  table: "表格",
  office: "文档",
  animation: "动画",
  archive: "压缩包",
  program: "程序",
  other: "文件",
};

export type PersonEntryFile = {
  id: string;
  name: string;
  url: string;
  mime: string;
  size: number;
  kind: PersonFileKind;
};

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "ico", "avif", "tif", "tiff", "heic", "heif"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "avi", "mkv", "m4v", "mpeg", "mpg", "3gp", "ogv", "wmv", "flv"]);
const AUDIO_EXT = new Set(["mp3", "wav", "aac", "m4a", "ogg", "flac", "wma", "aiff"]);
const PDF_EXT = new Set(["pdf"]);
const MARKDOWN_EXT = new Set(["md", "markdown", "mdx"]);
const LATEX_EXT = new Set(["tex", "latex", "ltx", "bib", "sty", "cls"]);
const TABLE_EXT = new Set(["csv", "tsv", "tab"]);
const OFFICE_EXT = new Set([
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "odt",
  "odp",
  "ods",
  "rtf",
  "wps",
  "et",
  "dps",
  "pages",
  "key",
  "numbers",
]);
const ANIMATION_EXT = new Set(["apng", "lottie"]);
const ARCHIVE_EXT = new Set(["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "iso", "cab"]);
const PROGRAM_EXT = new Set([
  "exe",
  "msi",
  "dmg",
  "apk",
  "ipa",
  "app",
  "bat",
  "cmd",
  "bin",
  "run",
  "jar",
  "war",
  "dll",
  "so",
  "dylib",
  "deb",
  "rpm",
  "appimage",
  "wasm",
]);
const TEXT_EXT = new Set(["txt", "log", "ini", "conf", "cfg", "env", "gitignore", "editorconfig", "csv"]);
const CODE_EXT = new Set([
  "js",
  "ts",
  "tsx",
  "jsx",
  "mjs",
  "cjs",
  "py",
  "java",
  "c",
  "cc",
  "cpp",
  "h",
  "hpp",
  "go",
  "rs",
  "rb",
  "php",
  "swift",
  "kt",
  "cs",
  "sql",
  "json",
  "yml",
  "yaml",
  "xml",
  "html",
  "htm",
  "css",
  "scss",
  "less",
  "vue",
  "svelte",
  "r",
  "m",
  "scala",
  "lua",
  "pl",
  "sh",
  "zsh",
  "bash",
  "ps1",
  "ipynb",
  "dockerfile",
  "makefile",
  "cmake",
  "gradle",
  "toml",
  "lock",
]);

export function personFileExt(name: string): string {
  const base = String(name || "").split(/[?#]/)[0] || "";
  const slash = Math.max(base.lastIndexOf("/"), base.lastIndexOf("\\"));
  const file = slash >= 0 ? base.slice(slash + 1) : base;
  const dot = file.lastIndexOf(".");
  if (dot <= 0) return "";
  return file.slice(dot + 1).toLowerCase();
}

export function classifyPersonFile(name: string, mime = ""): PersonFileKind {
  const ext = personFileExt(name);
  const type = String(mime || "").toLowerCase();
  if (ext === "gif" || ext === "webp") return type.startsWith("video/") ? "video" : "image";
  if (IMAGE_EXT.has(ext) || type.startsWith("image/")) return "image";
  if (VIDEO_EXT.has(ext) || type.startsWith("video/")) return "video";
  if (AUDIO_EXT.has(ext) || type.startsWith("audio/")) return "audio";
  if (PDF_EXT.has(ext) || type === "application/pdf") return "pdf";
  if (MARKDOWN_EXT.has(ext)) return "markdown";
  if (LATEX_EXT.has(ext)) return "latex";
  if (TABLE_EXT.has(ext)) return "table";
  if (OFFICE_EXT.has(ext) || type.includes("officedocument") || type.includes("msword") || type.includes("ms-excel") || type.includes("ms-powerpoint")) {
    return "office";
  }
  if (ANIMATION_EXT.has(ext)) return "animation";
  if (ARCHIVE_EXT.has(ext) || type.includes("zip") || type.includes("compressed") || type.includes("tar")) {
    return "archive";
  }
  if (PROGRAM_EXT.has(ext) || type.includes("msdownload") || type === "application/x-msdownload") {
    return "program";
  }
  if (CODE_EXT.has(ext)) return "code";
  if (TEXT_EXT.has(ext) || type.startsWith("text/")) return "text";
  return "other";
}

export function personFileCanInlinePreview(kind: PersonFileKind): boolean {
  return (
    kind === "image" ||
    kind === "video" ||
    kind === "audio" ||
    kind === "pdf" ||
    kind === "text" ||
    kind === "code" ||
    kind === "markdown" ||
    kind === "latex" ||
    kind === "table" ||
    kind === "office" ||
    kind === "animation"
  );
}

export function personFileIsTextLike(kind: PersonFileKind): boolean {
  return kind === "text" || kind === "code" || kind === "markdown" || kind === "latex" || kind === "table";
}

function clipName(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[/\\]/g, "_")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, PERSON_FILE_NAME_MAX);
}

function clipUrl(raw: unknown): string {
  const text = String(raw ?? "").replace(/\u0000/g, "").trim().slice(0, 800);
  if (!text) return "";
  if (/^(https?:\/\/|\/uploads\/|\/api\/)/i.test(text)) return text;
  return "";
}

function fileId(raw: unknown, fallback: string): string {
  const id = String(raw ?? "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 40);
  return id || fallback;
}

export function normalizePersonFiles(raw: unknown): PersonEntryFile[] {
  let list: unknown[] = [];
  if (typeof raw === "string") {
    try {
      list = JSON.parse(raw || "[]") as unknown[];
    } catch {
      list = [];
    }
  } else if (Array.isArray(raw)) {
    list = raw;
  }
  const out: PersonEntryFile[] = [];
  for (const [index, item] of list.entries()) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const url = clipUrl(row.url);
    const name = clipName(row.name) || `file-${index + 1}`;
    if (!url) continue;
    const size = Number(row.size);
    const mime = String(row.mime ?? "").trim().slice(0, 120);
    out.push({
      id: fileId(row.id, `f${index}-${name.slice(0, 12)}`),
      name,
      url,
      mime,
      size: Number.isFinite(size) ? Math.max(0, Math.round(size)) : 0,
      kind: classifyPersonFile(name, mime),
    });
    if (out.length >= PERSON_MAX_FILES) break;
  }
  return out;
}

export function personFilePreviewPath(entryId: string, fileIdValue: string): string {
  return `/api/person/files/${encodeURIComponent(entryId)}/${encodeURIComponent(fileIdValue)}?mode=preview`;
}

export function personFileDownloadPath(entryId: string, fileIdValue: string): string {
  return `/api/person/files/${encodeURIComponent(entryId)}/${encodeURIComponent(fileIdValue)}?mode=download`;
}

export function personFileTextPath(entryId: string, fileIdValue: string): string {
  return `/api/person/files/${encodeURIComponent(entryId)}/${encodeURIComponent(fileIdValue)}?mode=text`;
}

export function formatPersonFileSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function personEntryAdminHint(kind: string): string {
  if (kind === "RESUME") return "简历文档格式不限。访客可预览或下载。";
  if (kind === "INTRO_VIDEO") return "上传视频自我介绍，访客可在栏目里直接播放。";
  if (kind === "PROJECT") return "可上传开源代码、压缩包、文档或演示，访客可预览或下载。";
  return "可上传图片、视频、文档、PDF、PPT、表格、LaTeX、Markdown、代码、压缩包或程序。访客可预览或下载。";
}

export function firstPersonVideo(files: PersonEntryFile[]): PersonEntryFile | undefined {
  return files.find((file) => file.kind === "video");
}
