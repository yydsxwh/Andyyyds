/**
 * 软件产品 · MathCode
 * 公开 URL：/products/mathcode
 *
 * 未登录 / 非站长：展示介绍卡片 + 登录入口（不暴露识别工具）。
 * 站长：加载客户端上传工具，实际识别调用 /api/mathcode/ocr。
 */

import Link from "next/link";
import { MathcodeTool } from "@/components/mathcode-tool";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "MathCode · 公式截图 / PDF 转 LaTeX",
  description:
    "上传数学、物理、化学公式的截图或 PDF，由 AI 识别为 LaTeX 源码，方便二次排版并生成 PDF。",
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
            公式截图 / PDF 转 LaTeX
          </h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base">
            上传截图或 PDF，由 AI 把图上全部文字转成 LaTeX：任何语言的叙述都原样保留，只有公式进入数学模式。一键复制或下载 .tex，再用 xelatex 编译成 PDF。
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
