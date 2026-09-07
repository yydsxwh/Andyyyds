/**
 * POST /api/mathcode/ocr
 *
 * 站长上传单张公式截图，AI 返回 LaTeX 源码。
 * 前端 PDF 场景在浏览器里逐页渲染成 PNG 后仍然走这个接口，一次识别一张，
 * 好处：接口简单、失败可按页重试、也避开 Node 端 PDF→图片的原生依赖。
 *
 * 权限：登录用户。站长不限次免费；其余按会员 150 页或 0.5 元/页，成功后扣 1 页。
 */

import { NextResponse } from "next/server";
import { callMathcodeOcr, resolveMathcodeProvider } from "@andyyyds/mathcode/lib/mathcode";
import {
  chargeMathcodePageAfterSuccess,
  requireMathcodePageCredit,
  requireMathcodeSession,
} from "@andyyyds/mathcode/lib/mathcode-gate";

export const runtime = "nodejs";
/** 视觉识别整页公式可能耗时，放宽到 2 分钟 */
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export async function POST(req: Request) {
  try {
    const auth = await requireMathcodeSession();
    if (auth.error || !auth.session) return auth.error;
    const session = auth.session;
    const gated = await requireMathcodePageCredit(session);
    if (gated) return gated;

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "请选择图片" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        {
          error: `单张图片不能超过 ${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)}MB`,
        },
        { status: 400 },
      );
    }
    const mime = (file.type || "").toLowerCase() || "image/png";
    if (!ALLOWED_IMAGE_MIME.has(mime)) {
      return NextResponse.json(
        { error: "仅支持 png / jpg / webp / gif" },
        { status: 400 },
      );
    }

    const provider = await resolveMathcodeProvider();
    if (!provider.apiKey) {
      return NextResponse.json(
        {
          error:
            "未配置视觉识别 API Key。请先在系统设置「语言与翻译」中填入 OpenAI 兼容 Key，且所选模型需支持视觉（默认 gpt-4o-mini）。也可通过环境变量 MATHCODE_API_KEY / MATHCODE_API_BASE / MATHCODE_MODEL 单独配置。",
        },
        { status: 400 },
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    const userHint = form.get("userHint");

    const latex = await callMathcodeOcr({
      provider,
      imageDataUrl: dataUrl,
      userHint: typeof userHint === "string" ? userHint : "",
    });
    const charged = await chargeMathcodePageAfterSuccess(
      session,
      file.name || "ocr",
    );
    if (charged) return charged;
    return NextResponse.json({
      latex,
      model: provider.model,
      chars: latex.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "识别失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
