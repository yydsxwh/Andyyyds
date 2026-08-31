import { NextResponse } from "next/server";
import { storeUpload } from "@andyyyds/shared/storage";
import { requireAdmin, studioErrorResponse } from "@andyyyds/shared/studio";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
// 不收 SVG：以 image/svg+xml 回源时可嵌脚本，装修图只允许位图
const ALLOWED_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "请选择图片文件" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "图片不能超过 8MB" }, { status: 400 });
    }
    const mime = file.type || "application/octet-stream";
    if (
      mime === "image/svg+xml" ||
      /\.svg$/i.test(file.name) ||
      (!ALLOWED_IMAGE_MIME.has(mime) && !/\.(png|jpe?g|webp|gif)$/i.test(file.name))
    ) {
      return NextResponse.json(
        { error: "仅支持 png / jpg / webp / gif" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeUpload({
      ownerId: session.id,
      fileName: file.name || "image.png",
      buffer,
      mimeType: mime.startsWith("image/") ? mime : "image/png",
      kind: "file",
    });

    return NextResponse.json({ url: stored.fileUrl });
  } catch (error) {
    const mapped = studioErrorResponse(error);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }
}
