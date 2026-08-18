import type { Metadata } from "next";
import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "下载 Windows 客户端",
  description:
    "安装歪歪滴艾斯（YYDS）Windows 客户端，在电脑上使用与官网一致的完整功能。",
};

/** 推荐 ZIP：Edge/Chrome 对裸 exe 常提示「通常不会下载」 */
const ZIP_PUBLIC_PATH = "/app/yyds-windows.zip";
const EXE_PUBLIC_PATH = "/app/yyds-windows.exe";

function assetReady(fileName: string) {
  return existsSync(path.join(process.cwd(), "public", "app", fileName));
}

/**
 * Windows 便携客户端下载页：Electron 壳加载线上站点，
 * 登录 / 支付 / 上传 / 点播 / 聊天与网页版一致。
 */
export default function WindowsAppDownloadPage() {
  const zipOnDisk = assetReady("yyds-windows.zip");
  const exeOnDisk = assetReady("yyds-windows.exe");
  const ready = zipOnDisk || exeOnDisk;

  return (
    <div className="container py-10 sm:py-14">
      <div className="mx-auto max-w-lg space-y-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm text-[var(--brand)] underline-offset-2 hover:underline"
        >
          ← 返回首页
        </Link>

        <section className="surface rounded-[28px] px-6 py-10 text-center sm:px-10">
          <p className="text-sm font-medium text-[var(--brand)]">
            Windows 客户端
          </p>
          <h1 className="brand-mark mt-3 text-3xl font-semibold sm:text-4xl">
            歪歪滴艾斯 · YYDS
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            网易云风格桌面客户端（便携版，无需安装）。深色侧栏 +
            自定义标题栏，打开后加载
            www.yydsxwh.com，课程学习、下单支付、素材上传、聊天与网页版功能完整一致。
          </p>

          {ready ? (
            <div className="mt-8 flex flex-col items-center gap-3">
              {zipOnDisk ? (
                <a
                  href={ZIP_PUBLIC_PATH}
                  download="yyds-windows.zip"
                  className="btn btn-primary inline-flex min-h-12 w-full max-w-xs items-center justify-center sm:w-auto sm:px-8"
                >
                  下载压缩包（推荐）
                </a>
              ) : null}
              {exeOnDisk ? (
                <a
                  href={EXE_PUBLIC_PATH}
                  download="yyds-windows.exe"
                  className="btn btn-secondary inline-flex min-h-12 w-full max-w-xs items-center justify-center sm:w-auto sm:px-8"
                >
                  直接下载 .exe
                </a>
              ) : null}
            </div>
          ) : (
            <p className="mt-8 rounded-2xl border border-[var(--line)] bg-white/50 px-4 py-3 text-sm text-[var(--muted)]">
              安装包正在准备中，请稍后再来，或直接使用电脑浏览器访问官网。
            </p>
          )}

          <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
            支持 Windows 10 / 11（64 位）。推荐先下 ZIP，解压后双击
            yyds-windows.exe 即可运行。
          </p>

          <p className="mt-6 text-sm text-[var(--muted)]">
            需要手机版？{" "}
            <Link
              href="/app"
              className="font-medium text-[var(--brand)] underline-offset-2 hover:underline"
            >
              下载 Android 应用
            </Link>
          </p>
        </section>

        <section className="rounded-[28px] border border-[var(--line)] bg-white/40 px-5 py-5 text-left text-sm leading-7 text-[var(--muted)]">
          <h2 className="text-base font-semibold text-[var(--ink)]">
            浏览器提示「通常不会下载」怎么办？
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              这是 Edge/Chrome 对<strong>未常见 exe</strong>
              的安全提示，不是网站坏了。优先用上方「下载压缩包」。
            </li>
            <li>
              若仍出现提示：点下载栏右侧 <strong>…</strong> →{" "}
              <strong>保留</strong> → <strong>仍要保留</strong>。
            </li>
            <li>
              首次运行若出现 SmartScreen：点 <strong>更多信息</strong> →{" "}
              <strong>仍要运行</strong>。
            </li>
          </ul>
        </section>

        <section className="rounded-[28px] border border-[var(--line)] bg-white/40 px-5 py-5 text-left text-sm leading-7 text-[var(--muted)]">
          <h2 className="text-base font-semibold text-[var(--ink)]">使用说明</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              完整复刻官网：页面、登录态、工作室后台、支付与上传均走同一套线上服务。
            </li>
            <li>
              微信支付 / 支付宝：会按系统能力唤起本机已安装的支付应用或打开对应页面。
            </li>
            <li>文件下载（课程资料等）会保存到系统默认下载目录。</li>
            <li>菜单提供刷新、缩放、在浏览器中打开当前页等常用操作。</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
