/**
 * POST /api/mathcode/ocr
 *
 * 站长上传单张公式截图，AI 返回 LaTeX 源码。
 * 前端 PDF 场景在浏览器里逐页渲染成 PNG 后仍然走这个接口，一次识别一张，
 * 好处：接口简单、失败可按页重试、也避开 Node 端 PDF→图片的原生依赖。
 *
 * 权限：仅站长（AI 视觉调用有成本，先内测；未来可放开给注册用户再谈限额）。
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { callMathcodeOcr, resolveMathcodeProvider } from "@/lib/mathcode";
import { isAdmin } from "@/lib/roles";

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

    const latex = await callMathcodeOcr({
      provider,
      imageDataUrl: dataUrl,
    });
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
