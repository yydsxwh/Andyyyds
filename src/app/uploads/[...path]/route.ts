/**
 * 运行时上传文件（含微信推文转存图）不在 next build 的 public 快照里，
 * production 下直接访问 /uploads/... 会 404。本路由从磁盘读 public/uploads。
 */
import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

function resolveSafeUploadPath(segments: string[]): string | null {
  if (!segments.length) return null;
  if (segments.some((s) => !s || s === "." || s === ".." || s.includes("\0"))) {
    return null;
  }
  const absolute = path.resolve(UPLOADS_ROOT, ...segments);
  const rootWithSep = UPLOADS_ROOT.endsWith(path.sep)
    ? UPLOADS_ROOT
    : UPLOADS_ROOT + path.sep;
  if (absolute !== UPLOADS_ROOT && !absolute.startsWith(rootWithSep)) {
    return null;
  }
  return absolute;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const segments = (await context.params).path || [];
  const absolute = resolveSafeUploadPath(segments);
  if (!absolute) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  try {
    const info = await stat(absolute);
    if (!info.isFile()) {
      return new NextResponse("Not Found", { status: 404 });
    }
    const data = await readFile(absolute);
    const ext = path.extname(absolute).toLowerCase();
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": MIME_BY_EXT[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=2592000, immutable",
        "Content-Length": String(data.length),
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
