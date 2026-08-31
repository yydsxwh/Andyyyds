/**
 * POST /api/forum/media/complete
 * 浏览器直传 OSS 完成后合并分片，返回入库用的 canonical url。
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { isOwnedForumMediaUrl } from "@/lib/forum";
import { classifyMediaKind, inferMimeType } from "@/lib/media";
import {
  completeOssBrowserMultipart,
  resolveStoredAccessUrl,
} from "@/lib/storage";

export const runtime = "nodejs";

const schema = z.object({
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().max(120).optional(),
  fileUrl: z.string().trim().min(1).max(2000),
  oss: z.object({
    objectKey: z.string().trim().min(1).max(1000),
    uploadId: z.string().trim().min(1).max(200),
    parts: z
      .array(
        z.object({
          partNumber: z.coerce.number().int().min(1).max(10000),
          etag: z.string().trim().min(1).max(200),
        }),
      )
      .min(1)
      .max(10000),
  }),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const body = schema.parse(await req.json());
    if (
      !body.oss.objectKey.includes(`/${session.id}/`) ||
      !isOwnedForumMediaUrl(body.fileUrl, session.id)
    ) {
      return NextResponse.json({ error: "文件不属于当前账号" }, { status: 403 });
    }
    await completeOssBrowserMultipart(body.oss);
    const mimeType = inferMimeType(body.mimeType || "", body.fileName);
    const mediaKind = classifyMediaKind(mimeType, body.fileName);
    const kind = mediaKind === "VIDEO" ? "video" : "image";
    const previewUrl = (await resolveStoredAccessUrl(body.fileUrl)) || body.fileUrl;
    return NextResponse.json({
      url: body.fileUrl,
      previewUrl,
      kind,
    });
  } catch {
    return NextResponse.json({ error: "合并上传失败" }, { status: 400 });
  }
}
