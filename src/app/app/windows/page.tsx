import type { Metadata } from "next";
import Link from "next/link";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "下载 Windows 客户端",
  description:
    "安装歪歪滴艾斯（YYDS）Windows 客户端，可自选安装路径并生成桌面快捷方式。",
};

const SETUP_PUBLIC_PATH = "/app/yyds-windows-setup.exe";
const ZIP_PUBLIC_PATH = "/app/yyds-windows.zip";
const EXE_PUBLIC_PATH = "/app/yyds-windows.exe";

function assetMeta(fileName: string) {
  const full = path.join(process.cwd(), "public", "app", fileName);
  if (!existsSync(full)) return { ready: false as const, sizeLabel: "" };
  const mb = statSync(full).size / (1024 * 1024);
  const sizeLabel = mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
  return { ready: true as const, sizeLabel };
}

/**
 * Windows 客户端下载页。
 * 优先推荐 NSIS 安装包（可选路径 + 桌面/开始菜单快捷方式）；
 * 便携 ZIP/EXE 作备选（浏览器拦截更少时可下 ZIP）。
 */
export default function WindowsAppDownloadPage() {
  const setup = assetMeta("yyds-windows-setup.exe");
  const zip = assetMeta("yyds-windows.zip");
  const exe = assetMeta("yyds-windows.exe");
  const ready = setup.ready || zip.ready || exe.ready;

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
            网易云风格桌面客户端。安装时可自选文件夹，并自动创建桌面与开始菜单快捷方式；打开后加载
            www.yydsxwh.com，课程、支付、上传、聊天、转 LaTeX（MathCode）与网页版一致。
          </p>

          {ready ? (
            <div className="mt-8 flex flex-col items-center gap-3">
              {setup.ready ? (
                <a
                  href={SETUP_PUBLIC_PATH}
                  download="yyds-windows-setup.exe"
                  className="btn btn-primary inline-flex min-h-12 w-full max-w-xs items-center justify-center sm:w-auto sm:px-8"
                >
                  下载安装包（推荐 · 约 {setup.sizeLabel}）
                </a>
              ) : null}
              {zip.ready ? (
                <a
                  href={ZIP_PUBLIC_PATH}
                  download="yyds-windows.zip"
                  className="btn btn-secondary inline-flex min-h-12 w-full max-w-xs items-center justify-center sm:w-auto sm:px-8"
                >
                  下载便携压缩包（约 {zip.sizeLabel}）
                </a>
              ) : null}
              {exe.ready ? (
                <a
                  href={EXE_PUBLIC_PATH}
                  download="yyds-windows.exe"
                  className="btn btn-secondary inline-flex min-h-12 w-full max-w-xs items-center justify-center text-sm sm:w-auto sm:px-8"
                >
                  直接下载便携版 .exe（约 {exe.sizeLabel}）
                </a>
              ) : null}
            </div>
          ) : (
            <p className="mt-8 rounded-2xl border border-[var(--line)] bg-white/50 px-4 py-3 text-sm text-[var(--muted)]">
              安装包正在准备中，请稍后再来，或直接使用电脑浏览器访问官网。
            </p>
          )}

          <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
            支持 Windows 10 / 11（64 位）。安装包内含 Chromium，大约 90MB。推荐「安装包」：安装向导里可选路径，装完桌面会出现「歪歪滴艾斯」图标。
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
            安装后怎么打开？
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              桌面双击 <strong>歪歪滴艾斯</strong> 图标（安装包会自动创建）。
            </li>
            <li>
              或点开始菜单 → 搜索「歪歪滴艾斯」。
            </li>
            <li>
              若你下的是便携 ZIP：解压后双击文件夹里的{" "}
              <strong>yyds-windows.exe</strong>
              （便携版不会自动生成桌面图标）。
            </li>
          </ul>
        </section>

        <section className="rounded-[28px] border border-[var(--line)] bg-white/40 px-5 py-5 text-left text-sm leading-7 text-[var(--muted)]">
          <h2 className="text-base font-semibold text-[var(--ink)]">
            浏览器提示「通常不会下载」怎么办？
          </h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              这是 Edge/Chrome 对<strong>未常见 exe</strong>
              的安全提示。可改下「便携压缩包」，或点下载栏{" "}
              <strong>…</strong> → <strong>保留</strong> →{" "}
              <strong>仍要保留</strong>。
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
              完整复刻官网：页面、登录态、工作室后台、支付与上传均走同一套线上服务。侧栏「转 LaTeX」打开 MathCode（公式截图 / PDF 转 LaTeX）。
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
