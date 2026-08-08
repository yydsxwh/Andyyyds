import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { CouponCapture } from "@/components/coupon-capture";
import { ReferralCapture } from "@/components/referral-capture";
import { SiteFontLinks } from "@/components/site-font-loader";
import { SiteHeader } from "@/components/site-header";
import { SiteTypographyStyles } from "@/components/site-typography-styles";
import { TiltParallaxProvider } from "@/components/tilt-parallax-provider";
import { DEFAULT_DECORATE, DEFAULT_LOGO_URL } from "@/lib/decorate";
import { getDecorateConfig } from "@/lib/site-settings";
import { resolveThemeFx } from "@/lib/site-theme-islands";
import {
  buildThemeStyleVars,
  paletteById,
  themePackById,
} from "@/lib/site-theme";
import {
  buildTypographyCss,
  buildTypographyFontVars,
  collectTypographyFontUrls,
  typoRoleClass,
  typoRoleStyle,
} from "@/lib/site-typography";
import "./globals.css";

// 不用 next/font/google：香港机器构建时常拉不到 fonts.googleapis.com 导致整站发版失败。
// 站长选中的中文字体在运行时按需 CDN 注入（见 SiteFontLinks）。

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
  // 标签栏 / 收藏夹图标用商标图形标（由 /brand/logo.png 裁切）；与顶栏完整 Logo 配套
  return {
    title: {
      default: siteName,
      template: `%s · ${siteName}`,
    },
    applicationName: siteName,
    description:
      "多功能门户：公司与个人介绍、知识付费、商城/论坛/游戏中心陆续开放",
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
      shortcut: "/favicon.ico",
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const decorate = await getDecorateConfig();
  const logoUrl = decorate.logoUrl || DEFAULT_LOGO_URL;
  const siteName =
    decorate.siteName?.trim() ||
    decorate.brandName?.trim() ||
    DEFAULT_DECORATE.siteName;
  // 站长装扮：配色/背景/字号/字体写入 html，全站（含微信内）即时读 CSS 变量
  const themeStyle = buildThemeStyleVars({
    paletteId: decorate.paletteId,
    backgroundId: decorate.backgroundId,
    layoutDensity: decorate.layoutDensity,
    fontSizes: decorate.fontSizes,
    fontFamilyVars: buildTypographyFontVars(decorate.typography),
  }) as CSSProperties;
  const typographyCss = buildTypographyCss(decorate.typography);
  const fontUrls = collectTypographyFontUrls(decorate.typography);
  // 海岛/阳光等装扮的 CSS 动效（光斑/海浪）；无则不挂属性
  const themeFx = resolveThemeFx({
    themePackId: decorate.themePackId,
    backgroundId: decorate.backgroundId,
    packFx: themePackById(decorate.themePackId)?.fx,
  });

  return (
    <html
      lang="zh-CN"
      className="h-full"
      style={themeStyle}
      data-theme-fx={themeFx || undefined}
    >
      <body className="min-h-full flex flex-col antialiased">
        <TiltParallaxProvider>
          <SiteFontLinks urls={fontUrls} />
          <SiteTypographyStyles css={typographyCss} />
          <ReferralCapture />
          <CouponCapture />
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <footer className="glass-bar border-t py-8 text-sm text-[var(--muted)]">
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
                    className={`brand-mark text-[var(--ink)] ${typoRoleClass("brand")}`}
                    style={typoRoleStyle("brand")}
                  >
                    {decorate.brandName}
                  </span>
                ) : null}
              </div>
              <span>{siteName}</span>
            </div>
          </footer>
        </TiltParallaxProvider>
      </body>
    </html>
  );
}
