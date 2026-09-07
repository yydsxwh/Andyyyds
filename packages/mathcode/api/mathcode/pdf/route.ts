/**
 * POST /api/mathcode/pdf
 * 把当前 .tex（及可选水印图）编成 PDF。登录即可，不另扣页。
 */

import { NextResponse } from "next/server";
import {
  compileLatexToPdf,
  MATHCODE_PDF_MAX_ATTACH_BYTES,
  MATHCODE_PDF_MAX_TEX_CHARS,
} from "@andyyyds/mathcode/lib/mathcode-pdf";
import { requireMathcodeSession } from "@andyyyds/mathcode/lib/mathcode-gate";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

type Body = {
  tex?: string;
  attachments?: {
    path?: string;
    mime?: string;
    base64?: string;
  }[];
};

export async function POST(req: Request) {
  try {
    const auth = await requireMathcodeSession();
    if (auth.error) return auth.error;

    const body = (await req.json()) as Body;
    const tex = String(body.tex || "");
    if (!tex.trim()) {
      return NextResponse.json({ error: "没有可编译的 LaTeX" }, { status: 400 });
    }
    if (tex.length > MATHCODE_PDF_MAX_TEX_CHARS) {
      return NextResponse.json(
        { error: "源码过长，请拆成更小的文档再预览" },
        { status: 400 },
      );
    }

    const attachments = [];
    for (const item of body.attachments || []) {
      const path = String(item.path || "watermark.png").replace(
        /[^a-zA-Z0-9._-]/g,
        "",
      );
      const raw = String(item.base64 || "").replace(/\s/g, "");
      if (!path || !raw) continue;
      const bytes = Buffer.from(raw, "base64");
      if (bytes.length > MATHCODE_PDF_MAX_ATTACH_BYTES) {
        return NextResponse.json(
          { error: `附件 ${path} 超过 2MB` },
          { status: 400 },
        );
      }
      attachments.push({ path, bytes });
    }

    const result = await compileLatexToPdf({ tex, attachments });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return new NextResponse(new Uint8Array(result.pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="mathcode.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "编译失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
