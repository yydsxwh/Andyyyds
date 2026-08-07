import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canViewAllStudioData } from "@/lib/roles";
import {
  LOCAL_MEDIA_MISSING_MESSAGE,
  pickLessonMediaSource,
  resolveMediaAccessUrl,
} from "@/lib/storage";
import { requireCourseStudioUser, studioErrorResponse } from "@/lib/studio";

export const runtime = "nodejs";

function wantsHtml(req: Request) {
  const accept = req.headers.get("accept") || "";
  const mode = req.headers.get("sec-fetch-mode") || "";
  return mode === "navigate" || accept.includes("text/html");
}

function htmlError(message: string, status: number) {
  const safe = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>预览失败</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; line-height: 1.6; color: #0f172a; }
    a { color: #0284c7; }
  </style>
</head>
<body>
  <h1>无法预览素材</h1>
  <p>${safe}</p>
  <p><a href="/studio/media">返回素材中心</a></p>
</body>
</html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

/**
 * 素材预览：点播 / 私有 OSS / 本地上传签发可访问地址后跳转。
 * 浏览器直接打开时返回可读错误页，避免只看到框架 404。
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const html = wantsHtml(req);
  try {
    const session = await requireCourseStudioUser();
    const { id } = await params;
    // 站长可预览全站素材；其他人仅自己的
    const asset = await prisma.mediaAsset.findFirst({
      where: canViewAllStudioData(session.role)
        ? { id }
        : { id, ownerId: session.id },
    });
    if (!asset) {
      const msg = "素材不存在或无权预览";
      return html
        ? htmlError(msg, 404)
        : NextResponse.json({ error: msg }, { status: 404 });
    }

    const sourceUrl = pickLessonMediaSource({
      videoUrl: asset.fileUrl,
      mediaAsset: asset,
    });
    if (!sourceUrl) {
      const msg = "该素材没有可播放的文件地址";
      return html
        ? htmlError(msg, 404)
        : NextResponse.json({ error: msg }, { status: 404 });
    }

    const playUrl = await resolveMediaAccessUrl(sourceUrl);
    if (!playUrl) {
      const msg = "暂无播放地址，视频可能仍在转码中，请稍后重试";
      return html
        ? htmlError(msg, 404)
        : NextResponse.json({ error: msg }, { status: 404 });
    }

    // 相对路径补全为绝对地址，避免异常 Location
    const target = playUrl.startsWith("http")
      ? playUrl
      : new URL(playUrl, req.url).toString();
    return NextResponse.redirect(target);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "获取播放地址失败";
    if (message.includes("处理中")) {
      return html
        ? htmlError(message, 409)
        : NextResponse.json({ error: message }, { status: 409 });
    }
    if (message === LOCAL_MEDIA_MISSING_MESSAGE) {
      return html
        ? htmlError(message, 404)
        : NextResponse.json({ error: message }, { status: 404 });
    }
    const mapped = studioErrorResponse(error);
    const errText =
      mapped.error === "无权访问" || mapped.status === 401 || mapped.status === 403
        ? mapped.error
        : message;
    const status =
      mapped.status === 401 || mapped.status === 403 ? mapped.status : 400;
    return html
      ? htmlError(errText, status)
      : NextResponse.json({ error: errText }, { status });
  }
}
