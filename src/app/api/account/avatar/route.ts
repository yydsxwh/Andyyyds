/**
 * POST /api/account/avatar
 * 当前登录用户上传头像（图片 → OSS/本地），写入 User.avatarUrl。
 * 任意已登录角色均可设置；返回签名后的预览 URL 便于立刻显示。
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { prisma } from "@andyyyds/shared/db";
import { resolveStoredAccessUrl, storeUpload } from "@andyyyds/shared/storage";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "请选择图片文件" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "头像不能超过 5MB" }, { status: 400 });
    }
    const mime = file.type || "application/octet-stream";
    if (
      !ALLOWED_IMAGE_MIME.has(mime) &&
      !/\.(png|jpe?g|webp|gif)$/i.test(file.name)
    ) {
      return NextResponse.json(
        { error: "仅支持 png / jpg / webp / gif" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeUpload({
      ownerId: session.id,
      fileName: file.name || "avatar.jpg",
      buffer,
      mimeType: mime.startsWith("image/") ? mime : "image/jpeg",
      kind: "file",
    });

    const updated = await prisma.user.update({
      where: { id: session.id },
      data: { avatarUrl: stored.fileUrl },
      select: { avatarUrl: true },
    });

    const displayUrl = await resolveStoredAccessUrl(updated.avatarUrl);
    return NextResponse.json({
      ok: true,
      avatarUrl: updated.avatarUrl,
      displayUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
