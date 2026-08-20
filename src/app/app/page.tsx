import type { Metadata } from "next";
import Link from "next/link";
import { existsSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "下载 Android 应用",
  description:
    "安装歪歪滴艾斯（YYDS）课程平台 Android 客户端，在手机上使用完整网站功能。",
};

const APK_PUBLIC_PATH = "/app/yyds.apk";

function assetReady(fileName: string) {
  return existsSync(path.join(process.cwd(), "public", "app", fileName));
}

/**
 * Android APK 下载页：壳应用通过 WebView 加载线上站点，
 * 登录 / 支付 / 上传 / 点播与网页版一致。
 */
export default function AppDownloadPage() {
  const apkOnDisk = assetReady("yyds.apk");
  const winOnDisk =
    assetReady("yyds-windows-setup.exe") ||
    assetReady("yyds-windows.zip") ||
    assetReady("yyds-windows.exe");

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
          <p className="text-sm font-medium text-[var(--brand)]">Android 应用</p>
          <h1 className="brand-mark mt-3 text-3xl font-semibold sm:text-4xl">
            歪歪滴艾斯 · YYDS
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
            将官网包装为可安装的 Android 应用。打开后直接访问
            www.yydsxwh.com，课程学习、下单支付、素材上传与网页版功能一致。
          </p>

          {apkOnDisk ? (
            <a
              href={APK_PUBLIC_PATH}
              download="yyds.apk"
              className="btn btn-primary mt-8 inline-flex min-h-12 w-full max-w-xs items-center justify-center sm:w-auto sm:px-8"
            >
              下载安装包（APK）
            </a>
          ) : (
            <p className="mt-8 rounded-2xl border border-[var(--line)] bg-white/50 px-4 py-3 text-sm text-[var(--muted)]">
              安装包正在准备中，请稍后再来，或直接使用手机浏览器访问官网。
            </p>
          )}

          <p className="mt-4 text-xs leading-6 text-[var(--muted)]">
            若系统提示「未知来源」，请在系统设置中允许本浏览器/文件管理器安装应用。
          </p>

          {winOnDisk ? (
            <p className="mt-6 text-sm text-[var(--muted)]">
              需要电脑版？{" "}
              <Link
                href="/app/windows"
                className="font-medium text-[var(--brand)] underline-offset-2 hover:underline"
              >
                下载 Windows 客户端
              </Link>
            </p>
          ) : null}
        </section>

        <section className="rounded-[28px] border border-[var(--line)] bg-white/40 px-5 py-5 text-left text-sm leading-7 text-[var(--muted)]">
          <h2 className="text-base font-semibold text-[var(--ink)]">使用说明</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              微信支付：应用内会唤起微信 App（需已安装微信）；微信内 JSAPI
              场景与独立 App WebView 行为不同。
            </li>
            <li>支付宝：同样通过系统跳转到支付宝 App 完成付款。</li>
            <li>视频与上传：走官网与阿里云点播/OSS，需保持网络畅通。</li>
            <li>系统返回键：先后退网页历史，到首页后再按一次退出应用。</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
