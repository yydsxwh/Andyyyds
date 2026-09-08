/**
 * GET /api/person/files/[entryId]/[fileId]
 * 已发布栏目的附件预览 / 下载 / 文本。未发布的只有站长能看。
 */

import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { isAdmin } from "@andyyyds/shared/roles";
import { resolveStoredAccessUrl } from "@andyyyds/shared/storage";
import {
  PERSON_TEXT_PREVIEW_MAX,
  personFileIsTextLike,
} from "@andyyyds/person/lib/person-files";
import { getPersonEntryFile } from "@andyyyds/person/lib/person-site-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".tex": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function localUploadPath(fileUrl: string): string | null {
  if (!fileUrl.startsWith("/uploads/")) return null;
  const segments = fileUrl.split("/").filter(Boolean).slice(1);
  if (segments.some((part) => part === "." || part === ".." || part.includes("\0"))) {
    return null;
  }
  const absolute = path.resolve(UPLOADS_ROOT, ...segments);
  const root = UPLOADS_ROOT.endsWith(path.sep) ? UPLOADS_ROOT : `${UPLOADS_ROOT}${path.sep}`;
  if (absolute !== UPLOADS_ROOT && !absolute.startsWith(root)) return null;
  return absolute;
}

function contentType(fileName: string, mime: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (MIME_BY_EXT[ext]) return MIME_BY_EXT[ext];
  if (mime && mime !== "application/octet-stream") return mime;
  return "application/octet-stream";
}

function disposition(mode: string, fileName: string): string {
  const encoded = encodeURIComponent(fileName).replace(/'/g, "%27");
  const type = mode === "download" ? "attachment" : "inline";
  return `${type}; filename*=UTF-8''${encoded}`;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ entryId: string; fileId: string }> },
) {
  const { entryId, fileId } = await ctx.params;
  const modeRaw = new URL(req.url).searchParams.get("mode") || "preview";
  const mode = modeRaw === "download" || modeRaw === "text" ? modeRaw : "preview";

  const session = await getSession();
  const publishedOnly = !(session && isAdmin(session));
  const found = await getPersonEntryFile(entryId, fileId, publishedOnly);
  if (!found) {
    return NextResponse.json({ error: "文件不存在或未发布" }, { status: 404 });
  }
  const { file } = found;

  if (mode === "text") {
    if (!personFileIsTextLike(file.kind)) {
      return NextResponse.json({ error: "这个文件不能当文本预览" }, { status: 400 });
    }
    if (file.size > PERSON_TEXT_PREVIEW_MAX) {
      return NextResponse.json({ error: "文件太大，请下载后查看" }, { status: 400 });
    }
    const local = localUploadPath(file.url);
    if (local) {
      const info = await stat(local);
      if (info.size > PERSON_TEXT_PREVIEW_MAX) {
        return NextResponse.json({ error: "文件太大，请下载后查看" }, { status: 400 });
      }
      const text = await readFile(local, "utf8");
      return NextResponse.json({ text, name: file.name });
    }
    const access = await resolveStoredAccessUrl(file.url);
    const res = await fetch(access);
    if (!res.ok) return NextResponse.json({ error: "无法读取文件" }, { status: 502 });
    const text = await res.text();
    return NextResponse.json({ text: text.slice(0, PERSON_TEXT_PREVIEW_MAX), name: file.name });
  }

  const local = localUploadPath(file.url);
  if (local) {
    const data = await readFile(local);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType(file.name, file.mime),
        "Content-Disposition": disposition(mode, file.name),
        "Cache-Control": "public, max-age=3600",
        "Content-Length": String(data.length),
      },
    });
  }

  const access = await resolveStoredAccessUrl(file.url, {
    contentDisposition: mode === "download" ? "attachment" : "inline",
    fileName: file.name,
  });
  return NextResponse.redirect(access, 302);
}
