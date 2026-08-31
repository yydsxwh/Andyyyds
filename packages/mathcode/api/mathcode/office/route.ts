/**
 * POST /api/mathcode/office
 * 上传 Word / WPS / PPT / 表格 / OpenDocument，拆成文字块 + 内嵌图，
 * 再由前端逐块走 /convert 或 /ocr。站长专用。
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import {
  MATHCODE_MAX_OFFICE_BYTES,
  classifyMathcodeFile,
} from "@andyyyds/mathcode/lib/mathcode-filetypes";
import { extractOfficeDocument } from "@andyyyds/mathcode/lib/mathcode-office";
import { isAdmin } from "@andyyyds/shared/roles";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }
    if (!isAdmin(session)) {
      return NextResponse.json(
        { error: "MathCode 目前仅站长可用" },
        { status: 403 },
      );
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "请选择文档" }, { status: 400 });
    }
    if (file.size > MATHCODE_MAX_OFFICE_BYTES) {
      return NextResponse.json(
        {
          error: `文档不能超过 ${Math.floor(MATHCODE_MAX_OFFICE_BYTES / 1024 / 1024)}MB`,
        },
        { status: 400 },
      );
    }
    const kind = classifyMathcodeFile(file.name, file.type);
    if (kind !== "office") {
      return NextResponse.json(
        { error: "请上传 Word / WPS / PPT / 表格 / OpenDocument 文件" },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const units = await extractOfficeDocument({
      fileName: file.name,
      buf,
    });
    return NextResponse.json({
      filename: file.name,
      units,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "解析失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
