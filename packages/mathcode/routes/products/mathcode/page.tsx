/**
 * 软件产品 · MathCode
 * 公开 URL：/products/mathcode
 *
 * 未登录 / 非站长：展示介绍卡片 + 登录入口（不暴露识别工具）。
 * 站长：加载客户端上传工具，实际识别调用 /api/mathcode/ocr。
 */

import Link from "next/link";
import { MathcodeTool } from "@andyyyds/mathcode/components/mathcode-tool";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { OpenVsCodeButton } from "@andyyyds/mathcode/components/open-vscode-button";
import { getSession } from "@andyyyds/shared/auth";
import { MATHCODE_EDITOR_LINKS } from "@andyyyds/mathcode/lib/mathcode-open";
import { isAdmin } from "@andyyyds/shared/roles";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "MathCode · 文档转 LaTeX",
  description:
    "上传或粘贴公式截图、PDF、Word、WPS、PPT、表格或 Markdown，并可填写本轮微调提示词，由 AI 转为可编辑的 LaTeX 源码。",
};

export default async function MathcodePage() {
  const session = await getSession();
  const admin = Boolean(session && isAdmin(session));

  return (
    <NavPageTemplateShell type="products">
      <div className="container py-10 sm:py-12">
        <header className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-[var(--brand)]">
            软件产品 · MathCode
          </p>
          <h1 className="brand-mark mt-2 text-3xl font-semibold sm:text-4xl">
            文档 / 截图转 LaTeX
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base">
            支持公式截图、PDF、Word、WPS、PPT、Excel 表格和 Markdown。
            可以选文件、拖拽，也可以 Ctrl+V / 长按粘贴（截图、PDF 等）。
            每次识别前可写一栏微调提示词。只复刻原文有的文字、公式和色块，不编点评、不编公众号、不补没拍到的内容。
            输出完整 XeLaTeX + ctex 源码，可用下方按钮直接送进 Overleaf 或 VS Code。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              className="btn btn-primary min-h-11 px-4"
              href={MATHCODE_EDITOR_LINKS.overleaf}
              target="_blank"
              rel="noopener noreferrer"
            >
              打开 Overleaf
            </a>
            <OpenVsCodeButton className="btn btn-secondary min-h-11 px-4">
              打开 VS Code
            </OpenVsCodeButton>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            这是编辑器入口。VS Code 会优先打开电脑客户端，没有再打开网页版。
            识别完成后，结果框里的同名按钮会把<strong>当前生成的 .tex</strong>送进去。
            Windows 客户端侧栏也有「转 LaTeX」，与本页同一套工具，无需另装独立软件。
          </p>
          <p className="mt-2 text-xs">
            <Link
              href="/app/windows"
              className="font-medium text-[var(--brand)] underline-offset-2 hover:underline"
            >
              下载网站 Windows 客户端
            </Link>
          </p>
        </header>

        {admin ? (
          <MathcodeTool />
        ) : (
          <section className="surface rounded-[28px] p-6 text-sm leading-7 text-[var(--muted)] sm:p-8">
            <p className="text-base font-medium text-[var(--ink)]">
              本工具目前仅站长可用
            </p>
            <p className="mt-3">
              为控制 AI 识别成本，MathCode 现阶段对内使用，后续将逐步开放给注册用户并设置额度。
              若你希望优先体验或希望覆盖特定识别场景（教材、试题、化学结构式、物理受力图等），欢迎联系站长。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {session ? (
                <Link href="/" className="btn btn-secondary">
                  返回首页
                </Link>
              ) : (
                <Link href="/login" className="btn btn-primary">
                  登录
                </Link>
              )}
              <Link href="/products" className="btn btn-secondary">
                返回软件产品
              </Link>
            </div>
          </section>
        )}
      </div>
    </NavPageTemplateShell>
  );
}
