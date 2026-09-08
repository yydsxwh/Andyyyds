/**
 * POST /api/person-admin/files
 * 站长给个人展示栏目上传附件。类型尽量放开，程序只存不执行。
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@andyyyds/shared/studio";
import { storeUpload } from "@andyyyds/shared/storage";
import { personAdminError } from "@andyyyds/person/api/person-admin/respond";
import {
  PERSON_MAX_FILE_BYTES,
  PERSON_MAX_FILE_LABEL,
  classifyPersonFile,
} from "@andyyyds/person/lib/person-files";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "请选择文件" }, { status: 400 });
    }
    if (file.size > PERSON_MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `单个文件不能超过 ${PERSON_MAX_FILE_LABEL}` },
        { status: 400 },
      );
    }

    const name = (file.name || "file").replace(/[/\\]/g, "_").slice(0, 180);
    const mime = file.type || "application/octet-stream";
    const kind = classifyPersonFile(name, mime);
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeUpload({
      ownerId: session.id,
      fileName: name,
      buffer,
      mimeType: mime,
      kind: kind === "video" ? "video" : "file",
      subPath: `person/${kind}`,
    });

    return NextResponse.json({
      id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name,
      url: stored.fileUrl,
      mime,
      size: file.size,
      kind,
    });
  } catch (error) {
    return personAdminError(error);
  }
}
