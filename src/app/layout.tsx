import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { ReferralCapture } from "@/components/referral-capture";
import { SiteHeader } from "@/components/site-header";
import { DEFAULT_DECORATE, DEFAULT_LOGO_URL } from "@/lib/decorate";
import { getDecorateConfig } from "@/lib/site-settings";
import { buildThemeStyleVars, paletteById } from "@/lib/site-theme";
import "./globals.css";

// 不用 next/font/google：香港机器构建时常拉不到 fonts.googleapis.com 导致整站发版失败。
// 字体栈在 globals.css 的 --font-body / --font-display 中定义。

export async function generateViewport(): Promise<Viewport> {
  const decorate = await getDecorateConfig();
  return {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: paletteById(decorate.paletteId).tokens.bg,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const decorate = await getDecorateConfig();
  const siteName =
    decorate.siteName?.trim() ||
    decorate.brandName?.trim() ||
    DEFAULT_DECORATE.siteName;
  return {
    title: {
      default: siteName,
      template: `%s · ${siteName}`,
    },
    applicationName: siteName,
    description:
      "多功能门户：公司与个人介绍、知识付费、商城/论坛/游戏中心陆续开放",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const decorate = await getDecorateConfig();
  const logoUrl = decorate.logoUrl || DEFAULT_LOGO_URL;
  const siteName =
    decorate.siteName?.trim() ||
    decorate.brandName?.trim() ||
    DEFAULT_DECORATE.siteName;
  // 站长装扮：把配色/背景写入 html，全站（含微信内）即时读 CSS 变量
  const themeStyle = buildThemeStyleVars({
    paletteId: decorate.paletteId,
    backgroundId: decorate.backgroundId,
    layoutDensity: decorate.layoutDensity,
    fontSizes: decorate.fontSizes,
  }) as CSSProperties;

  return (
    <html lang="zh-CN" className="h-full" style={themeStyle}>
      <body className="min-h-full flex flex-col antialiased">
        <ReferralCapture />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[var(--line)] py-8 text-sm text-[var(--muted)]">
          <div className="container flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={siteName}
                className="h-8 w-auto max-w-[160px] object-contain"
              />
              {decorate.showBrandText ? (
                <span
                  className="brand-mark text-[var(--ink)]"
                  style={{ fontSize: "var(--fs-brand)" }}
                >
                  {decorate.brandName}
                </span>
              ) : null}
            </div>
            <span>{siteName}</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
