/**
 * 站长上传背景音乐音频（MP3 等），存入站点存储后返回可播放 URL。
 */

import { NextResponse } from "next/server";
import { ALLOWED_AUDIO_MIME } from "@/lib/media";
import { resolveStoredAccessUrl, storeUpload } from "@/lib/storage";
import { requireAdmin, studioErrorResponse } from "@/lib/studio";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "请选择音频文件" }, { status: 400 });
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "音频不能超过 20MB" }, { status: 400 });
    }
    const mime = file.type || "application/octet-stream";
    const byExt = /\.(mp3|wav|aac|m4a|ogg)$/i.test(file.name);
    if (!ALLOWED_AUDIO_MIME.has(mime) && !byExt) {
      return NextResponse.json(
        { error: "仅支持 mp3 / wav / aac / m4a / ogg" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeUpload({
      ownerId: session.id,
      fileName: file.name || "bgm.mp3",
      buffer,
      mimeType: mime.startsWith("audio/") ? mime : "audio/mpeg",
      kind: "file",
      subPath: "bg-music",
    });

    const previewUrl = await resolveStoredAccessUrl(stored.fileUrl);
    return NextResponse.json({
      url: stored.fileUrl,
      previewUrl: previewUrl || stored.fileUrl,
    });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    if (mapped.status !== 500) {
      return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }
    const message = error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
