/**
 * 软件产品 · MathCode
 * 公开 URL：/products/mathcode
 *
 * 未登录：介绍 + 价格 + 登录。
 * 已登录：上传工具 + 额度条；站长不限次免费，其余先付再转。
 */

import Link from "next/link";
import { MathcodeTool } from "@andyyyds/mathcode/components/mathcode-tool";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { OpenVsCodeButton } from "@andyyyds/mathcode/components/open-vscode-button";
import { getSession } from "@andyyyds/shared/auth";
import { MATHCODE_EDITOR_LINKS } from "@andyyyds/mathcode/lib/mathcode-open";
import {
  MATHCODE_GUEST_CENTS_PER_PAGE,
  MATHCODE_MEMBER_CENTS_PER_PAGE,
  MATHCODE_MEMBERSHIP_CENTS,
  MATHCODE_MEMBERSHIP_PAGES,
} from "@andyyyds/mathcode/lib/mathcode-quota";
import { formatPrice } from "@andyyyds/shared/utils";

export const dynamic = "force-dynamic";

export default async function MathcodePage() {
  const session = await getSession();

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

        {session ? (
          <MathcodeTool />
        ) : (
          <section className="surface rounded-[28px] p-6 text-sm leading-7 text-[var(--muted)] sm:p-8">
            <p className="text-base font-medium text-[var(--ink)]">
              登录后即可转换，先付再转
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                未开会员：{formatPrice(MATHCODE_GUEST_CENTS_PER_PAGE)} / 页（1 张图
                = 1 页，PDF 一页 = 1 次），调用微信支付后再识别。
              </li>
              <li>
                会员 {formatPrice(MATHCODE_MEMBERSHIP_CENTS)} / 月，含{" "}
                {MATHCODE_MEMBERSHIP_PAGES} 页（30 ÷ 0.2 = 150，相当于{" "}
                {formatPrice(MATHCODE_MEMBER_CENTS_PER_PAGE)} / 页）。
              </li>
              <li>
                150 页用完须再开通会员，获得新的 150 页，不能按 0.5 元补差。
              </li>
              <li>站长账号不限次免费。</li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login?next=/products/mathcode" className="btn btn-primary min-h-11">
                登录后使用
              </Link>
              <Link href="/products" className="btn btn-secondary min-h-11">
                返回软件产品
              </Link>
            </div>
          </section>
        )}
      </div>
    </NavPageTemplateShell>
  );
}
