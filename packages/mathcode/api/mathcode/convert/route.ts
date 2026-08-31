/**
 * POST /api/mathcode/convert
 * 把 Markdown / 纯文本 / 表格文本转成 LaTeX 正文。站长专用。
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import {
  callMathcodeTextConvert,
  resolveMathcodeProvider,
} from "@andyyyds/mathcode/lib/mathcode";
import { looksLikeExistingLatex, passthroughLatex } from "@andyyyds/mathcode/lib/mathcode-doc";
import { isAdmin } from "@andyyyds/shared/roles";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const MAX_CHARS = 80_000;

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

    const body = (await req.json()) as {
      text?: string;
      filename?: string;
    };
    const text = String(body.text || "").trim();
    const filename = String(body.filename || "document").slice(0, 180);
    if (!text) {
      return NextResponse.json({ error: "没有可转换的文本" }, { status: 400 });
    }

    if (looksLikeExistingLatex(text) || /\.tex$/i.test(filename)) {
      const latex = passthroughLatex(text);
      return NextResponse.json({
        latex,
        passthrough: true,
        chars: latex.length,
      });
    }

    const provider = await resolveMathcodeProvider();
    if (!provider.apiKey) {
      return NextResponse.json(
        {
          error:
            "未配置视觉识别 API Key。请先在系统设置「语言与翻译」中填入 OpenAI 兼容 Key。",
        },
        { status: 400 },
      );
    }

    const latex = await callMathcodeTextConvert({
      provider,
      text: text.slice(0, MAX_CHARS),
      sourceLabel: filename,
    });
    return NextResponse.json({
      latex,
      model: provider.model,
      chars: latex.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "转换失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
