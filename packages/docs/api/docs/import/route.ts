/**
 * POST /api/docs/import
 * 把 Word / WPS 转成文档 JSON。不落库，游客也能打开再另存。
 */

import { NextResponse } from "next/server";
import {
  DOCS_IMPORT_MAX_BYTES,
  importOfficeBuffer,
} from "@andyyyds/docs/lib/docs-import";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "请选择要打开的文件" }, { status: 400 });
    }
    if (file.size > DOCS_IMPORT_MAX_BYTES) {
      return NextResponse.json({ error: "文件不能超过 8MB" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const imported = await importOfficeBuffer(buffer, file.name || "文档.docx");
    return NextResponse.json(imported);
  } catch (error) {
    const message = error instanceof Error ? error.message : "打开文件失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
